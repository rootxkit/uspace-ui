// AlertToaster and useAlertTone (WP-11), with a mocked AudioContext and
// fake timers: no sound before a gesture and the "enable" control in its
// place (a muted console is a visible state, E-02); after the gesture a
// tone at once and at every `repeatMs` (the server's number, 02 F5);
// stops on acknowledgement and on clear (each with the twin that keeps
// going); mute is visible; no Web Audio is visible and counted. Notices:
// one per alert id (C-06), a rise is its own notice (C-07) and an equal
// re-raise is not, a critical notice stays until acknowledged or cleared,
// a warning leaves after the display hold, the limit.
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n/I18nProvider.js";
import type { Lang } from "../i18n/lang.js";
import type { AlertView } from "../model/index.js";
import { axeCheck } from "../test/axe.js";
import {
  AlertToaster,
  TOAST_HOLD_MS,
  TOAST_LIMIT,
  type AlertToasterProps,
} from "./AlertToaster.js";
import { alertCounters, resetAlertCountersForTests } from "./counters.js";
import { alert, SERVER_REPEAT_MS } from "./fixtures.testing.js";
import { playTone, TONE_HZ } from "./tone.js";

/** A Web Audio stand-in that counts the tones started on it. */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: "running" | "suspended" | "closed" = "running";
  currentTime = 0;
  destination = {};
  tones = 0;
  frequencies: number[] = [];
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createOscillator() {
    return {
      type: "",
      frequency: {
        setValueAtTime: (hz: number) => {
          this.frequencies.push(hz);
        },
      },
      connect: vi.fn(),
      start: () => {
        this.tones += 1;
      },
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
}

const tones = (): number =>
  FakeAudioContext.instances.reduce((n, c) => n + c.tones, 0);

beforeEach(() => {
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetAlertCountersForTests();
});

const TONE = { tone: true, repeatMs: SERVER_REPEAT_MS };

function view(
  alerts: readonly AlertView[],
  over: Partial<AlertToasterProps>,
  lang: Lang,
): ReactNode {
  return (
    <I18nProvider lang={lang}>
      <AlertToaster alerts={alerts} {...over} />
    </I18nProvider>
  );
}

function mount(
  alerts: readonly AlertView[],
  over: Partial<AlertToasterProps> = { critical: TONE },
  lang: Lang = "en",
) {
  const r = render(view(alerts, over, lang));
  return {
    ...r,
    update(next: readonly AlertView[], nextOver = over) {
      r.rerender(view(next, nextOver, lang));
    },
  };
}

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const enable = (): void => {
  fireEvent.click(screen.getByRole("button", { name: "Enable alert sound" }));
};
const toneState = (): string | undefined =>
  document.querySelector<HTMLElement>("[data-tone]")?.dataset["tone"];
const toasts = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>("li[data-toast]"),
];

describe("the tone", () => {
  it("sounds nothing before a gesture, and says so with a control", () => {
    mount([alert()]);
    advance(SERVER_REPEAT_MS * 3);
    expect(tones()).toBe(0);
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(toneState()).toBe("needs_gesture");
    expect(
      screen.getByText("Alert sound is off until you enable it"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Repeats every 10 s while a critical alert is not acknowledged",
      ),
    ).toBeTruthy();
  });

  it("after the gesture: a tone at once, then one every repeatMs", () => {
    mount([alert()]);
    enable();
    expect(toneState()).toBe("on");
    expect(tones()).toBe(1);
    expect(FakeAudioContext.instances[0]?.frequencies).toEqual([TONE_HZ]);
    advance(SERVER_REPEAT_MS - 1);
    expect(tones()).toBe(1);
    advance(1);
    expect(tones()).toBe(2);
    advance(SERVER_REPEAT_MS * 2);
    expect(tones()).toBe(4);
    expect(
      document.querySelector("[data-sounding]")?.getAttribute("data-sounding"),
    ).toBe("true");
  });

  it("stops when the alert is acknowledged on this console", () => {
    const r = mount([alert()]);
    enable();
    r.update([alert({ acknowledged: true })]);
    advance(SERVER_REPEAT_MS * 3);
    expect(tones()).toBe(1);
    expect(
      document.querySelector("[data-sounding]")?.getAttribute("data-sounding"),
    ).toBe("false");
  });

  it("keeps going while it is not (the twin of the acknowledgement)", () => {
    const r = mount([alert()]);
    enable();
    r.update([alert({ state: "updated" })]);
    advance(SERVER_REPEAT_MS * 3);
    expect(tones()).toBe(4);
  });

  it("stops when the alert clears", () => {
    const r = mount([alert()]);
    enable();
    r.update([alert({ state: "cleared", clearReason: "resolved" })]);
    advance(SERVER_REPEAT_MS * 3);
    expect(tones()).toBe(1);
  });

  it("does not sound for a warning, or with no critical alert", () => {
    const r = mount([alert({ severity: "warning" })]);
    enable();
    advance(SERVER_REPEAT_MS * 2);
    r.update([]);
    advance(SERVER_REPEAT_MS * 2);
    expect(tones()).toBe(0);
    expect(toneState()).toBe("on");
  });

  it("a second critical alert sounds at once and restarts the period", () => {
    const r = mount([alert({ alertId: "a" })]);
    enable();
    advance(SERVER_REPEAT_MS / 2);
    r.update([alert({ alertId: "a" }), alert({ alertId: "b" })]);
    expect(tones()).toBe(2);
    advance(SERVER_REPEAT_MS / 2);
    expect(tones()).toBe(2);
    advance(SERVER_REPEAT_MS / 2);
    expect(tones()).toBe(3);
  });

  it("a rise to critical sounds (C-07)", () => {
    const r = mount([alert({ severity: "warning" })]);
    enable();
    expect(tones()).toBe(0);
    r.update([alert({ severity: "critical" })]);
    expect(tones()).toBe(1);
  });

  it("mute is a visible state and silences; unmute sounds again", () => {
    mount([alert()]);
    enable();
    fireEvent.click(
      screen.getByRole("button", { name: "Turn alert sound off" }),
    );
    expect(toneState()).toBe("muted");
    expect(screen.getByText("Alert sound is off")).toBeTruthy();
    advance(SERVER_REPEAT_MS * 2);
    expect(tones()).toBe(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Turn alert sound on" }),
    );
    expect(toneState()).toBe("on");
    expect(tones()).toBe(2);
  });

  it("no Web Audio: visible and counted, never a silent 'on'", () => {
    vi.stubGlobal("AudioContext", undefined);
    mount([alert()]);
    enable();
    expect(toneState()).toBe("unavailable");
    expect(
      screen.getByText("Alert sound is not available in this browser"),
    ).toBeTruthy();
    expect(alertCounters().tone_unavailable).toBe(1);
  });

  it("an AudioContext that refuses to start is unavailable too", () => {
    // A constructor that throws, as a browser refusing to start audio.
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function refuse() {
        throw new Error("TEST refused");
      }),
    );
    mount([alert()]);
    enable();
    expect(toneState()).toBe("unavailable");
    expect(alertCounters().tone_unavailable).toBe(1);
  });

  it("an unusable repeatMs sounds once, shows a dash, and counts", () => {
    mount([alert()], { critical: { tone: true, repeatMs: 0 } });
    expect(screen.getByText(/Repeats every — s/)).toBeTruthy();
    enable();
    advance(60_000);
    expect(tones()).toBe(1);
    expect(alertCounters().tone_repeat_invalid).toBe(1);
  });

  it("the app's switch off is visible, with no control and no sound", () => {
    mount([alert()], { critical: { tone: false, repeatMs: SERVER_REPEAT_MS } });
    expect(toneState()).toBe("disabled");
    expect(
      screen.getByText("Alert sound is switched off for this console"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Enable alert sound" }),
    ).toBeNull();
  });

  it("no critical policy given: the same visible 'off'", () => {
    mount([alert()], {});
    expect(toneState()).toBe("disabled");
  });

  it("closes its audio context on unmount", () => {
    const r = mount([alert()]);
    enable();
    r.unmount();
    expect(FakeAudioContext.instances[0]?.close).toHaveBeenCalled();
  });

  it("playTone resumes a suspended context and counts a failure", () => {
    const ctx = new FakeAudioContext();
    ctx.state = "suspended";
    playTone(ctx as unknown as AudioContext);
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.tones).toBe(1);
    const broken = {
      state: "running",
      createOscillator: () => {
        throw new Error("TEST");
      },
    };
    playTone(broken as unknown as AudioContext);
    expect(alertCounters().tone_failed).toBe(1);
  });
});

describe("the notices", () => {
  it("one notice per raise, replaced in place, never stacked (C-06)", () => {
    const r = mount([alert()]);
    r.update([alert({ state: "raised", detail: { t_cpa_s: 5 } })]);
    r.update([alert({ state: "updated" })]);
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]?.dataset["change"]).toBe("new");
  });

  it("a severity rise is its own notice (C-07)", () => {
    const r = mount([alert({ severity: "warning" })]);
    r.update([alert({ severity: "critical" })]);
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]?.dataset["change"]).toBe("rose");
    expect(toasts()[0]?.textContent).toContain(
      "Severity raised to Critical: Converging aircraft",
    );
  });

  it("an equal re-raise after dismissal shows nothing new (the twin)", () => {
    const r = mount([alert({ severity: "warning" })]);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Dismiss this notice; the alert stays in the list",
      }),
    );
    expect(toasts()).toHaveLength(0);
    r.update([alert({ severity: "warning", state: "raised" })]);
    expect(toasts()).toHaveLength(0);
  });

  it("a critical notice stays past the hold until acknowledged", () => {
    const r = mount([alert()]);
    advance(TOAST_HOLD_MS * 3);
    expect(toasts()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Dismiss/ })).toBeNull();
    r.update([alert({ acknowledged: true })]);
    expect(toasts()).toHaveLength(0);
  });

  it("a critical notice leaves when the alert clears or is no longer passed", () => {
    const r = mount([alert({ alertId: "a" }), alert({ alertId: "b" })]);
    expect(toasts()).toHaveLength(2);
    r.update([
      alert({ alertId: "a", state: "cleared", clearReason: "resolved" }),
    ]);
    expect(toasts()).toHaveLength(0);
  });

  it("a warning notice leaves after the display hold", () => {
    mount([alert({ severity: "warning" })]);
    advance(TOAST_HOLD_MS - 1);
    expect(toasts()).toHaveLength(1);
    advance(1);
    expect(toasts()).toHaveLength(0);
  });

  it("an acknowledged alert gets no notice", () => {
    mount([alert({ acknowledged: true })]);
    expect(toasts()).toHaveLength(0);
  });

  it(`holds at most ${TOAST_LIMIT}, dropping a non-critical one first`, () => {
    const many = [
      alert({ alertId: "w", severity: "warning" }),
      ...Array.from({ length: TOAST_LIMIT }, (_, i) =>
        alert({ alertId: `c${i}` }),
      ),
    ];
    mount(many);
    expect(toasts()).toHaveLength(TOAST_LIMIT);
    expect(toasts().map((t) => t.dataset["severity"])).not.toContain("warning");
  });

  it("holds at most the limit even when all are critical", () => {
    mount(
      Array.from({ length: TOAST_LIMIT + 2 }, (_, i) =>
        alert({ alertId: `c${i}` }),
      ),
    );
    expect(toasts()).toHaveLength(TOAST_LIMIT);
  });

  it("speaks Georgian and passes axe", async () => {
    vi.useRealTimers();
    const { container } = mount(
      [
        alert(),
        alert({ alertId: "w", severity: "warning", kind: "lost_link" }),
      ],
      { critical: TONE },
      "ka",
    );
    expect(container.textContent).toContain("გაფრთხილების ხმის ჩართვა");
    expect(container.textContent).not.toMatch(/alert\.|[{}]/);
    await axeCheck(container);
  });
});
