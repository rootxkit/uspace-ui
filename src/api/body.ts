// A response body kept under the deadline of the request that fetched it
// (retro-audit S4). The platform's fetch resolves on the answer's headers;
// a body that then stalls would otherwise be read forever. Internal: not
// exported from an entry point.

/** Statuses whose answers carry no body; `new Response(body)` refuses them. */
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

export interface GuardOptions {
  /** Aborting it errors the body with the signal's reason. */
  signal: AbortSignal;
  /**
   * The longest wait for one chunk while the reader is waiting, in ms; on
   * silence `onIdle` runs and the body errors with its result. Absent: no
   * idle bound, only `signal`. The clock runs only while a read is pending,
   * so a consumer that reads slowly is never counted against the upstream.
   */
  idleMs?: number;
  onIdle?: () => unknown;
  /** Runs once when the body ends, errors or is cancelled. */
  onEnd?: () => void;
}

/**
 * `body` wrapped so that every read races `signal` (and the idle bound).
 * Nothing is pulled before the consumer reads (high-water mark 0).
 */
export function guardBody(
  body: ReadableStream<Uint8Array>,
  opts: GuardOptions,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let ended = false;
  const end = (): void => {
    if (ended) return;
    ended = true;
    opts.onEnd?.();
  };
  const fail = (ctrl: ReadableStreamDefaultController, reason: unknown) => {
    end();
    ctrl.error(reason);
    reader.cancel(reason).catch(() => undefined);
  };
  return new ReadableStream<Uint8Array>(
    {
      async pull(ctrl) {
        const { signal } = opts;
        if (signal.aborted) {
          fail(ctrl, signal.reason);
          return;
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        let onAbort: (() => void) | undefined;
        const stop = new Promise<{ stop: unknown }>((resolve) => {
          onAbort = () => resolve({ stop: signal.reason });
          signal.addEventListener("abort", onAbort, { once: true });
          if (opts.idleMs !== undefined) {
            timer = setTimeout(
              () => resolve({ stop: opts.onIdle?.() }),
              opts.idleMs,
            );
          }
        });
        try {
          const r = await Promise.race([reader.read(), stop]);
          if ("stop" in r) fail(ctrl, r.stop);
          else if (r.done) {
            end();
            ctrl.close();
          } else ctrl.enqueue(r.value);
        } catch (e) {
          fail(ctrl, e);
        } finally {
          clearTimeout(timer);
          if (onAbort !== undefined)
            signal.removeEventListener("abort", onAbort);
        }
      },
      async cancel(reason) {
        end();
        await reader.cancel(reason);
      },
    },
    { highWaterMark: 0 },
  );
}

/**
 * `res` with its body guarded, or `null` when it has no body to guard (a
 * null body, or a status that carries none).
 */
export function guardResponse(
  res: Response,
  opts: GuardOptions,
): Response | null {
  if (res.body === null || NULL_BODY_STATUSES.has(res.status)) return null;
  return new Response(guardBody(res.body, opts), {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}
