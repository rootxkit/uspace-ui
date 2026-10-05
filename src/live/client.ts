// The live feed client (docs/PLAN.md §3.11, D8, §6.3, §7; WP-8). One
// WebSocket to the console's own system, opened same-origin so the browser
// sends the `uspace_session` cookie on the upgrade (M22); no token in the
// URL or a subprotocol, ever, and a URL that carries one is refused. It
// reconnects forever with exponential backoff and jitter (LESSONS B-08:
// the predecessor's console hung on an initial connect that retried sixty
// times; this one starts `connecting`, shows it, and never gives up). A
// close with 4401 means the session is gone: `onUnauthorized` once per
// outage, `down`, and the retries go on so a renewed cookie resumes the
// feed without a reload.
//
// State machine: `connecting` (a socket is being opened, or is open and no
// status frame has arrived yet) -> `live` (a valid `console/status/v1`
// arrived) -> `down` (the socket closed or could not open) -> `connecting`
// on the next attempt. `sinceMs` moves on each change. A quiet feed stays
// `live`: the ages it shows climb (E-02), and `lastFrameAtMs` says how
// long it has been quiet.
//
// Frames: a message that is not a console frame is counted and dropped,
// never thrown; `console/status/v1` sets the status and the source store;
// `console/snapshot/v1` replaces the stores given in the options (C-08:
// the replay is applied, not de-duplicated); everything else goes to
// `onFrame` untouched and is counted unhandled.
import type { AlertInput } from "./alertStore.js";
import {
  DEFAULT_BACKOFF,
  reconnectDelayMs,
  STABLE_AFTER_MS,
  type Backoff,
} from "./backoff.js";
import { countLive } from "./counters.js";
import { Emitter } from "./emitter.js";
import {
  NO_EXTRAS,
  parseFrameText,
  parseSnapshotBody,
  parseStatusBody,
  SNAPSHOT_SCHEMA,
  STATUS_SCHEMA,
  type ConsoleFrame,
  type StatusExtras,
  type SubscribeFrame,
} from "./frame.js";
import type { SourceStore } from "./sourceStore.js";
import { utcMs } from "./time.js";
import type { MannedStore, TrackStore } from "./trackStore.js";
import type { FeedStatus, MannedView, TrackView } from "../model/index.js";

/**
 * The close code a system's WS process uses when the session is gone.
 *
 * @public
 */
export const CLOSE_UNAUTHORIZED = 4401;

/**
 * Where a snapshot collection goes: the app's adapter, then a store.
 *
 * @public
 */
export interface SnapshotTarget<I> {
  store: { replace(items: readonly I[]): void };
  /** The app's adapter (typed by its generated types); null skips it. */
  adapt(frame: ConsoleFrame): I | null;
}

/**
 * The stores the feed fills by itself (PLAN §6.3 "Kit behaviour").
 *
 * @public
 */
export interface FeedStores {
  /** Filled from every status frame's `sources[]`. */
  sources?: SourceStore;
  /** Replaced by every snapshot's `tracks[]`. */
  tracks?: SnapshotTarget<Omit<TrackView, "receivedAtMs">> & {
    store: TrackStore;
  };
  /** Replaced by every snapshot's `manned[]`. */
  manned?: SnapshotTarget<Omit<MannedView, "receivedAtMs">> & {
    store: MannedStore;
  };
  /** Replaced by every snapshot's `alerts[]`. */
  alerts?: SnapshotTarget<AlertInput>;
}

/** @public */
export interface FeedOptions {
  /**
   * The system's WS path (relative, resolved against the page) or a
   * function returning it: a generic seam for an app that computes its
   * path, not a ticket (M22).
   */
  url: string | (() => Promise<string>);
  protocols?: string[];
  backoff?: Backoff;
  /** Every frame the kit does not store itself, untouched. */
  onFrame(frame: ConsoleFrame): void;
  /** The session is gone (close 4401): once per outage. */
  onUnauthorized?(): void;
  /** The browser clock; `Date.now` by default. */
  now?: () => number;
  /** The jitter source, in [0, 1); `Math.random` by default. */
  random?: () => number;
  /** Stores the feed fills from status and snapshot frames. */
  stores?: FeedStores;
}

/**
 * `FeedStatus` with what the status components and the app need too.
 *
 * @public
 */
export interface LiveStatus extends FeedStatus {
  /** The status frame's `connection_id`. */
  connectionId: string | null;
  /**
   * Server clock minus browser clock, from the last status frame's
   * `server_ts` against its arrival; for `ageS(..., "captured")` only.
   */
  clockOffsetMs: number | null;
  /** Browser clock of the last frame of any kind; null before the first. */
  lastFrameAtMs: number | null;
  /** Browser clock of the last valid status frame. */
  lastStatusAtMs: number | null;
  /** The last close was 4401 and the feed has not been live since. */
  unauthorized: boolean;
  /**
   * Attempts that failed in the current run of failures; a close after a
   * connection that stayed live `STABLE_AFTER_MS` starts a new run.
   */
  attempt: number;
  /** Browser clock of the next attempt while `down`; else null. */
  nextRetryAtMs: number | null;
  /** This feed's malformed frames (dropped) since it started. */
  framesMalformed: number;
  /** This feed's frames passed to `onFrame` without a kit store. */
  framesUnhandled: number;
  /** The last snapshot's `zones_version`; null before one. */
  zonesVersion: string | null;
  /** The optional extras of the last status frame (PLAN §6.3). */
  extras: StatusExtras;
}

const TOKENISH =
  /^(?:access_?token|id_?token|token|ticket|jwt|session|sid|auth|authorization|bearer|api_?key|key|sig|signature|password|secret)$/i;

/**
 * The WebSocket URL for `url`, resolved against `page` with the scheme
 * matched (http -> ws, https -> wss); or a refusal. Refused: a URL that
 * cannot be resolved, one with user info, a query parameter named like a
 * credential, a fragment, or another origin than the page's (M22: the
 * cookie on a same-origin upgrade is the only credential the kit sends).
 * Without `page` there is no origin to compare with, so even an absolute
 * URL is refused (`no_page`) rather than accepted unchecked (retro-audit
 * N8).
 *
 * @public
 */
export function resolveFeedUrl(
  url: string,
  page: string | undefined,
): { url: string } | { refused: string } {
  let resolved: URL;
  let pageUrl: URL | null = null;
  try {
    pageUrl = page === undefined ? null : new URL(page);
    resolved = pageUrl === null ? new URL(url) : new URL(url, pageUrl);
  } catch {
    return { refused: "unresolvable" };
  }
  if (resolved.protocol === "http:") resolved.protocol = "ws:";
  if (resolved.protocol === "https:") resolved.protocol = "wss:";
  if (resolved.protocol !== "ws:" && resolved.protocol !== "wss:")
    return { refused: "scheme" };
  if (resolved.username !== "" || resolved.password !== "")
    return { refused: "credentials" };
  for (const key of resolved.searchParams.keys()) {
    if (TOKENISH.test(key)) return { refused: "token_in_query" };
  }
  if (resolved.hash !== "") return { refused: "fragment" };
  if (pageUrl === null) return { refused: "no_page" };
  const pageWs = pageUrl.protocol === "https:" ? "wss:" : "ws:";
  if (resolved.host !== pageUrl.host || resolved.protocol !== pageWs)
    return { refused: "cross_origin" };
  return { url: resolved.toString() };
}

function initialStatus(nowMs: number): LiveStatus {
  return {
    connection: "connecting",
    sinceMs: nowMs,
    droppedFrames: 0,
    degraded: [],
    policyVersion: null,
    staleAfterS: null,
    liveMaxAgeS: null,
    serverTs: null,
    connectionId: null,
    clockOffsetMs: null,
    lastFrameAtMs: null,
    lastStatusAtMs: null,
    unauthorized: false,
    attempt: 0,
    nextRetryAtMs: null,
    framesMalformed: 0,
    framesUnhandled: 0,
    zonesVersion: null,
    extras: NO_EXTRAS,
  };
}

const OPEN = 1;

/**
 * The feed, without React: `useFeed` wraps it. `start` and `stop` may be
 * called again (React's development double effect); it never throws from
 * a socket event.
 *
 * @beta
 */
export class FeedClient {
  private opts: FeedOptions;
  private status: LiveStatus;
  private readonly emitter = new Emitter();
  private socket: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private run = 0;
  private liveAtMs: number | null = null;
  private unauthorizedNotified = false;
  private subscribeFrame: SubscribeFrame | null = null;
  private subscribeSent = false;

  constructor(opts: FeedOptions) {
    this.opts = opts;
    this.status = initialStatus(this.now());
  }

  /** The newest options (callbacks and stores); the URL is read per attempt. */
  setOptions(opts: FeedOptions): void {
    this.opts = opts;
  }

  getStatus = (): LiveStatus => this.status;

  subscribe = (fn: () => void): (() => void) => this.emitter.subscribe(fn);

  start(): void {
    if (this.running) return;
    this.running = true;
    this.run += 1;
    this.set({
      connection: "connecting",
      sinceMs: this.now(),
      attempt: 0,
      nextRetryAtMs: null,
    });
    void this.connect(this.run);
  }

  stop(): void {
    this.running = false;
    this.run += 1;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const s = this.socket;
    this.socket = null;
    if (s !== null) {
      s.onopen = null;
      s.onmessage = null;
      s.onclose = null;
      s.onerror = null;
      try {
        s.close(1000);
      } catch {
        // Closing a socket that never opened can throw; it is gone either way.
      }
    }
  }

  /**
   * Sends a `console/subscribe/v1` now if the socket is open, and again on
   * every reconnect; a newer frame replaces an older one.
   */
  send = (frame: SubscribeFrame): void => {
    if (this.subscribeFrame !== null && !this.subscribeSent)
      countLive("subscribe_superseded");
    this.subscribeFrame = frame;
    this.subscribeSent = false;
    this.flushSubscribe();
  };

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  private set(patch: Partial<LiveStatus>): void {
    const next = { ...this.status, ...patch };
    if (
      patch.connection !== undefined &&
      patch.connection !== this.status.connection &&
      patch.sinceMs === undefined
    )
      next.sinceMs = this.now();
    this.status = next;
    this.emitter.emit();
  }

  private flushSubscribe(): void {
    const s = this.socket;
    if (this.subscribeFrame === null || s === null || s.readyState !== OPEN)
      return;
    try {
      s.send(JSON.stringify(this.subscribeFrame));
      this.subscribeSent = true;
    } catch {
      // The socket is closing; the frame goes out again on the next open.
    }
  }

  private async connect(run: number): Promise<void> {
    if (run !== this.run) return;
    this.timer = null;
    countLive("connect_attempts");
    if (this.status.connection !== "connecting")
      this.set({ connection: "connecting", nextRetryAtMs: null });
    let raw: string;
    try {
      const u = this.opts.url;
      raw = typeof u === "string" ? u : await u();
    } catch {
      if (run !== this.run) return;
      countLive("connect_failed");
      this.retry(run, null);
      return;
    }
    if (run !== this.run) return;
    const page = (globalThis as { location?: { href?: string } }).location
      ?.href;
    const resolved = resolveFeedUrl(raw, page);
    if ("refused" in resolved) {
      countLive("url_refused");
      this.retry(run, null);
      return;
    }
    let socket: WebSocket;
    try {
      socket =
        this.opts.protocols === undefined
          ? new WebSocket(resolved.url)
          : new WebSocket(resolved.url, this.opts.protocols);
    } catch {
      countLive("connect_failed");
      this.retry(run, null);
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      if (run !== this.run) return;
      this.subscribeSent = false;
      this.flushSubscribe();
    };
    socket.onmessage = (ev: MessageEvent) => {
      if (run !== this.run) return;
      this.onMessage(ev.data);
    };
    socket.onerror = () => {
      // A close event follows; the retry is scheduled there.
    };
    socket.onclose = (ev: CloseEvent) => {
      if (run !== this.run) return;
      this.socket = null;
      countLive("closed");
      const upMs = this.liveAtMs === null ? null : this.now() - this.liveAtMs;
      this.liveAtMs = null;
      if (ev.code === CLOSE_UNAUTHORIZED) {
        countLive("unauthorized");
        this.status = { ...this.status, unauthorized: true };
        if (!this.unauthorizedNotified) {
          this.unauthorizedNotified = true;
          try {
            this.opts.onUnauthorized?.();
          } catch {
            // The app's callback is the app's; the feed keeps retrying.
          }
        }
      }
      this.retry(run, upMs);
    };
  }

  private retry(run: number, upMs: number | null): void {
    if (run !== this.run || !this.running) return;
    const stable = upMs !== null && upMs >= STABLE_AFTER_MS;
    const attempt = stable ? 0 : this.status.attempt;
    const random = (this.opts.random ?? Math.random)();
    const delay = reconnectDelayMs(
      attempt,
      this.opts.backoff ?? DEFAULT_BACKOFF,
      random,
    );
    this.set({
      connection: "down",
      attempt: attempt + 1,
      nextRetryAtMs: this.now() + delay,
    });
    this.timer = setTimeout(() => {
      void this.connect(run);
    }, delay);
  }

  private onMessage(data: unknown): void {
    countLive("frames_received");
    const nowMs = this.now();
    const frame = parseFrameText(data);
    if (frame === null) {
      countLive("frames_malformed");
      this.set({
        lastFrameAtMs: nowMs,
        framesMalformed: this.status.framesMalformed + 1,
      });
      return;
    }
    if (frame.schema === STATUS_SCHEMA) {
      this.onStatus(frame, nowMs);
      return;
    }
    if (frame.schema === SNAPSHOT_SCHEMA) {
      this.onSnapshot(frame, nowMs);
      return;
    }
    countLive("frames_unhandled");
    this.set({
      lastFrameAtMs: nowMs,
      framesUnhandled: this.status.framesUnhandled + 1,
    });
    this.deliver(frame);
  }

  private deliver(frame: ConsoleFrame): void {
    try {
      this.opts.onFrame(frame);
    } catch {
      // An adapter that throws on one frame must not end the feed.
    }
  }

  private onStatus(frame: ConsoleFrame, nowMs: number): void {
    const body = parseStatusBody(frame.body);
    if (body === null) {
      countLive("status_malformed");
      this.set({
        lastFrameAtMs: nowMs,
        framesMalformed: this.status.framesMalformed + 1,
      });
      return;
    }
    if (body.ignored.length > 0)
      countLive("status_extra_ignored", body.ignored.length);
    const serverMs = utcMs(body.serverTs);
    this.opts.stores?.sources?.applyStatus(body.sources, body.serverTs, nowMs);
    if (this.status.connection !== "live") {
      this.liveAtMs = nowMs;
      this.unauthorizedNotified = false;
    }
    this.set({
      connection: "live",
      droppedFrames: body.droppedFrames,
      degraded: body.degraded,
      policyVersion: body.policyVersion,
      staleAfterS: body.staleAfterS,
      liveMaxAgeS: body.liveMaxAgeS,
      serverTs: body.serverTs,
      connectionId: body.connectionId,
      clockOffsetMs: serverMs === null ? null : serverMs - nowMs,
      lastFrameAtMs: nowMs,
      lastStatusAtMs: nowMs,
      unauthorized: false,
      nextRetryAtMs: null,
      extras: {
        datasets: body.datasets,
        cisVersion: body.cisVersion,
        cisAgeS: body.cisAgeS,
        projectionAgeS: body.projectionAgeS,
        dpState: body.dpState,
        nats: body.nats,
        resyncSince: body.resyncSince,
        thresholds: body.thresholds,
        evaluationPeriodS: body.evaluationPeriodS,
      },
    });
    // The CISP's resync goes to the app as a status frame (PLAN §6.3).
    if (body.resyncSince !== null) this.deliver(frame);
  }

  private onSnapshot(frame: ConsoleFrame, nowMs: number): void {
    const parsed = parseSnapshotBody(frame.body);
    if (parsed === null) {
      countLive("snapshot_malformed");
      this.set({
        lastFrameAtMs: nowMs,
        framesMalformed: this.status.framesMalformed + 1,
      });
      return;
    }
    const { body, malformedItems } = parsed;
    if (malformedItems > 0)
      countLive("snapshot_item_malformed", malformedItems);
    const stores = this.opts.stores ?? {};
    this.fill(body.tracks, stores.tracks);
    this.fill(body.manned, stores.manned);
    this.fill(body.alerts, stores.alerts);
    this.set({ lastFrameAtMs: nowMs, zonesVersion: body.zonesVersion });
  }

  private fill<I>(
    frames: readonly ConsoleFrame[],
    target: SnapshotTarget<I> | undefined,
  ): void {
    if (target === undefined) {
      if (frames.length > 0) countLive("snapshot_collection_unstored");
      return;
    }
    const items: I[] = [];
    for (const f of frames) {
      let item: I | null = null;
      try {
        item = target.adapt(f);
      } catch {
        item = null;
      }
      if (item === null) countLive("snapshot_item_unadapted");
      else items.push(item);
    }
    target.store.replace(items);
  }
}
