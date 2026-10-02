// An in-process mock of a system's console WebSocket (WP-8 tests; PLAN §9).
// It replaces the global `WebSocket` with a constructor whose sockets the
// test drives as the server would: accept, send frames, close with a code,
// or refuse. Every constructor call is recorded (URL and protocols), so a
// test can assert over all of them (no token in a URL, M22). Sequences
// recorded in fixtures/sequences/*.json are replayed step by step against
// fake timers; README.md says how to record one from a real system.
//
// In process and without a network: the client under test is the same
// code that runs in the browser; only the transport is replaced, which is
// what lets a test drive backoff with fake timers to the millisecond.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { vi } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = join(HERE, "fixtures");

/** A lab example (`schemas/common/<path>`), as copied at LAB_COMMIT. */
export function labExample(path: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(FIXTURES, "lab", path), "utf8"),
  ) as Record<string, unknown>;
}

export function labCommit(): string {
  return readFileSync(join(FIXTURES, "lab", "LAB_COMMIT"), "utf8").trim();
}

export class MockSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockSocket.CONNECTING;
  readonly sent: string[] = [];
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  /** The code the client closed with, if it closed first. */
  closedByClient: number | null = null;

  constructor(
    readonly url: string,
    readonly protocols: string | string[] | undefined,
  ) {}

  send(data: string): void {
    if (this.readyState !== MockSocket.OPEN)
      throw new Error("InvalidStateError: socket not open");
    this.sent.push(data);
  }

  close(code = 1000): void {
    if (this.readyState === MockSocket.CLOSED) return;
    this.closedByClient = code;
    this.fireClose(code, "");
  }

  fireClose(code: number, reason: string): void {
    this.readyState = MockSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: code === 1000 } as CloseEvent);
  }
}

/** One step of a recorded sequence (fixtures/sequences/README.md). */
export type Step =
  | { op: "open" }
  | { op: "refuse"; code?: number }
  | { op: "frame"; lab: string; patch?: Record<string, unknown> }
  | { op: "frame"; frame: unknown }
  | { op: "text"; text: string }
  | { op: "wait"; ms: number }
  | { op: "close"; code: number; reason?: string };

export interface Sequence {
  name: string;
  recorded_from: string;
  description: string;
  steps: Step[];
}

export function loadSequence(name: string): Sequence {
  return JSON.parse(
    readFileSync(join(FIXTURES, "sequences", `${name}.json`), "utf8"),
  ) as Sequence;
}

export class MockWsServer {
  readonly sockets: MockSocket[] = [];

  /** Puts the mock in place of the global `WebSocket` (undone by vitest). */
  install(): this {
    const sockets = this.sockets;
    function MockWebSocket(url: string, protocols?: string | string[]) {
      const s = new MockSocket(url, protocols);
      sockets.push(s);
      return s;
    }
    vi.stubGlobal("WebSocket", MockWebSocket);
    return this;
  }

  /** Every URL a socket was constructed with, in order. */
  get urls(): string[] {
    return this.sockets.map((s) => s.url);
  }

  get current(): MockSocket {
    const s = this.sockets.at(-1);
    if (s === undefined) throw new Error("mock-server: no socket yet");
    return s;
  }

  /** Accepts the newest socket (the upgrade succeeded). */
  accept(): MockSocket {
    const s = this.current;
    if (s.readyState !== MockSocket.CONNECTING)
      throw new Error("mock-server: newest socket is not connecting");
    s.readyState = MockSocket.OPEN;
    s.onopen?.({} as Event);
    return s;
  }

  /** Refuses the newest socket before it opens (1006 by default). */
  refuse(code = 1006): void {
    const s = this.current;
    s.onerror?.({} as Event);
    s.fireClose(code, "");
  }

  /** Sends one frame (an object, as JSON) or raw text to the newest socket. */
  send(frame: unknown): void {
    const s = this.current;
    if (s.readyState !== MockSocket.OPEN)
      throw new Error("mock-server: newest socket is not open");
    const data = typeof frame === "string" ? frame : JSON.stringify(frame);
    s.onmessage?.({ data } as MessageEvent);
  }

  /** Closes the newest socket from the server's side. */
  close(code: number, reason = ""): void {
    this.current.fireClose(code, reason);
  }

  /**
   * Replays `seq`. `advance(ms)` moves the fake clock (and runs due
   * timers); an `open` step first advances until the client has made a
   * new socket, in steps of 100 ms, up to two minutes.
   */
  async replay(
    seq: Sequence,
    advance: (ms: number) => Promise<unknown>,
  ): Promise<void> {
    for (const step of seq.steps) {
      switch (step.op) {
        case "open":
        case "refuse": {
          let waited = 0;
          while (
            this.sockets.at(-1)?.readyState !== MockSocket.CONNECTING &&
            waited < 120_000
          ) {
            await advance(100);
            waited += 100;
          }
          if (step.op === "open") this.accept();
          else this.refuse(step.code);
          break;
        }
        case "frame":
          this.send(
            "lab" in step
              ? { ...labExample(step.lab), ...(step.patch ?? {}) }
              : step.frame,
          );
          break;
        case "text":
          this.send(step.text);
          break;
        case "wait":
          await advance(step.ms);
          break;
        case "close":
          this.close(step.code, step.reason);
          break;
        default:
          step satisfies never;
      }
    }
  }
}
