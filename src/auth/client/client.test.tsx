// auth/client (WP-5): the login form against a fetch stub, the Retry-After
// countdown under fake timers, the password cleared on every refusal,
// display gating with its fallback (E-01 pairs), the session provider's
// sign-out and the CSRF cookie reader. Fixture values only.
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionDisplay } from "../../model/index.js";
import { renderWithKit } from "../../test/render.js";
import { csrfToken } from "./csrf.js";
import { LoginForm } from "./LoginForm.js";
import { RequireRole } from "./RequireRole.js";
import { SessionProvider, useSession } from "./SessionProvider.js";

const USER = "TEST-user-01";
const PASSWORD = "TEST-fixture-password-01";
const ACTION = "/_bff/login";

function clearCookies(): void {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  clearCookies();
});

function answer(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const problem = status >= 400;
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": problem ? "application/problem+json" : "application/json",
      ...headers,
    },
  });
}

function refusal(status: number, detail: string | null): unknown {
  return {
    type: "https://schemas.uspace.ge/problems/rate_limited",
    title: "Refused",
    status,
    detail,
    instance: null,
    errors: [],
  };
}

function stub(...responses: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (next === undefined) throw new Error("no more answers");
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  return { fetch: fn as unknown as typeof fetch, calls, fn };
}

function fill(label: RegExp, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function submit(): Promise<void> {
  await act(async () => {
    fireEvent.submit(
      screen
        .getByRole("button", { name: /sign in/i })
        .closest("form") as HTMLFormElement,
    );
  });
}

function renderForm(f: typeof fetch, onSuccess = vi.fn(), mfa?: boolean) {
  renderWithKit(
    <LoginForm
      action={ACTION}
      onSuccess={onSuccess}
      fetch={f}
      {...(mfa === undefined ? {} : { mfa })}
    />,
  );
  return onSuccess;
}

const password = (): HTMLInputElement => screen.getByLabelText(/^password$/i);

describe("LoginForm", () => {
  it("posts the values as JSON to action, in the body and never in the URL", async () => {
    const s = stub(answer(200, { status: "signed_in" }));
    const onSuccess = renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    const before = window.location.href;
    await submit();
    expect(s.calls).toHaveLength(1);
    expect(s.calls[0]?.url).toBe(ACTION);
    expect(s.calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(s.calls[0]?.init.body))).toEqual({
      username: USER,
      password: PASSWORD,
    });
    expect(s.calls[0]?.url).not.toContain(PASSWORD);
    expect(window.location.href).toBe(before);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("declares the form POST, so even an unhydrated submit puts nothing in a URL", () => {
    renderForm(stub().fetch);
    const form = screen
      .getByRole("button", { name: /sign in/i })
      .closest("form");
    expect(form?.getAttribute("method")).toBe("post");
  });

  it("uses the autocomplete tokens the spec names", () => {
    renderForm(stub().fetch, vi.fn(), true);
    expect(
      screen.getByLabelText(/username/i).getAttribute("autocomplete"),
    ).toBe("username");
    expect(password().getAttribute("autocomplete")).toBe("current-password");
    expect(password().type).toBe("password");
    expect(
      screen.getByLabelText(/one-time code/i).getAttribute("autocomplete"),
    ).toBe("one-time-code");
  });

  it("has no one-time code field until the API asks for one (the twin)", () => {
    renderForm(stub().fetch);
    expect(screen.queryByLabelText(/one-time code/i)).toBeNull();
  });

  it("shows the problem detail and clears the password on a refusal", async () => {
    const s = stub(
      answer(401, refusal(401, "TEST: wrong username or password")),
    );
    const onSuccess = renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(
      "TEST: wrong username or password",
    );
    expect(password().value).toBe("");
    expect((screen.getByLabelText(/username/i) as HTMLInputElement).value).toBe(
      USER,
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("puts the focus on the cleared password after a refusal (A4)", async () => {
    const s = stub(answer(401, refusal(401, "TEST: refused")));
    renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    (document.activeElement as HTMLElement | null)?.blur();
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("TEST: refused");
    expect(document.activeElement).toBe(password());
  });

  it("leaves the focus alone when the sign-in succeeds (the A4 twin)", async () => {
    const s = stub(answer(200, { status: "signed_in" }));
    const onSuccess = renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    (document.activeElement as HTMLElement | null)?.blur();
    await submit();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(password());
    expect(document.activeElement).toBe(document.body);
  });

  it("says the status when the refusal has no problem body", async () => {
    const s = stub(new Response("nope", { status: 500 }));
    renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(
      "Sign-in refused (status 500)",
    );
    expect(password().value).toBe("");
  });

  it("says the service could not be reached when fetch fails, and clears the password", async () => {
    const s = stub(new TypeError("fetch failed"));
    renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    await submit();
    expect(screen.getByRole("alert").textContent).toMatch(
      /could not be reached/,
    );
    expect(password().value).toBe("");
  });

  it("on 429 with Retry-After: 30 counts down and keeps submit disabled until zero", async () => {
    vi.useFakeTimers();
    const s = stub(
      answer(429, refusal(429, "TEST: too many attempts"), {
        "Retry-After": "30",
      }),
    );
    renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    await submit();
    const button = screen.getByRole("button", { name: /sign in/i });
    expect(screen.getByRole("alert").textContent).toBe(
      "TEST: too many attempts",
    );
    expect(screen.getByTestId("retry-countdown").textContent).toBe(
      "Try again in 30 seconds",
    );
    expect(button).toHaveProperty("disabled", true);
    await act(async () => {
      vi.advanceTimersByTime(29_000);
    });
    expect(screen.getByTestId("retry-countdown").textContent).toBe(
      "Try again in 1 second",
    );
    expect(button).toHaveProperty("disabled", true);
    // A submit while counting down does not reach the BFF.
    await submit();
    expect(s.calls).toHaveLength(1);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId("retry-countdown")).toBeNull();
    expect(button).toHaveProperty("disabled", false);
  });

  it("starts no countdown for a refusal without Retry-After (the twin)", async () => {
    const s = stub(answer(401, refusal(401, "TEST: refused")));
    renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    await submit();
    expect(screen.queryByTestId("retry-countdown")).toBeNull();
    expect(screen.getByRole("button", { name: /sign in/i })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("sends the password once: the second request carries the username and the code", async () => {
    const s = stub(
      answer(200, { status: "mfa_required" }),
      answer(200, { status: "signed_in" }),
    );
    const onSuccess = renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    await submit();
    expect(JSON.parse(String(s.calls[0]?.init.body))).toEqual({
      username: USER,
      password: PASSWORD,
    });
    expect(screen.getByRole("status").textContent).toMatch(/one-time code/);
    // The password field and its value are gone once the first step passed.
    expect(screen.queryByLabelText(/^password$/i)).toBeNull();
    expect(screen.queryByTestId("enrolment")).toBeNull();
    fill(/one-time code/i, "000000");
    await submit();
    expect(JSON.parse(String(s.calls[1]?.init.body))).toEqual({
      username: USER,
      otp: "000000",
    });
    expect(String(s.calls[1]?.init.body)).not.toContain(PASSWORD);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("with the code typed up front, still sends the password and the code in separate requests", async () => {
    const s = stub(
      answer(200, { status: "mfa_required" }),
      answer(200, { status: "signed_in" }),
    );
    const onSuccess = renderForm(s.fetch, vi.fn(), true);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    fill(/one-time code/i, "000000");
    await submit();
    expect(s.calls.map((c) => JSON.parse(String(c.init.body)))).toEqual([
      { username: USER, password: PASSWORD },
      { username: USER, otp: "000000" },
    ]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("an API without MFA signs in with one request (the single-step twin)", async () => {
    const s = stub(answer(200, { status: "signed_in" }));
    const onSuccess = renderForm(s.fetch, vi.fn(), true);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    fill(/one-time code/i, "000000");
    await submit();
    expect(s.calls).toHaveLength(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("a refused code stays on the code step and clears the code", async () => {
    const s = stub(
      answer(200, { status: "mfa_required" }),
      answer(401, refusal(401, "TEST: wrong code")),
    );
    renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    await submit();
    fill(/one-time code/i, "000000");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("TEST: wrong code");
    expect(
      (screen.getByLabelText(/one-time code/i) as HTMLInputElement).value,
    ).toBe("");
    expect(document.activeElement).toBe(
      screen.getByLabelText(/one-time code/i),
    );
    expect(screen.queryByLabelText(/^password$/i)).toBeNull();
  });

  it("a missing or expired challenge goes back to the password step", async () => {
    const s = stub(
      answer(200, { status: "mfa_required" }),
      answer(401, {
        ...(refusal(401, "TEST: sign in again") as object),
        type: "https://schemas.uspace.ge/problems/mfa_challenge_missing",
      }),
    );
    renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    await submit();
    fill(/one-time code/i, "000000");
    await submit();
    expect(screen.getByRole("alert").textContent).toBe("TEST: sign in again");
    expect(password().value).toBe("");
    expect(document.activeElement).toBe(password());
    expect(screen.queryByLabelText(/one-time code/i)).toBeNull();
  });

  it("Start again returns to the password step", async () => {
    const s = stub(answer(200, { status: "mfa_required" }));
    renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    await submit();
    fireEvent.click(screen.getByRole("button", { name: /start again/i }));
    expect(password().value).toBe("");
    expect(screen.queryByLabelText(/one-time code/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /start again/i })).toBeNull();
  });

  it("shows the authenticator key while the account enrols", async () => {
    const s = stub(
      answer(200, {
        status: "mfa_required",
        enrolment: {
          secret: "TESTSECRETBASE32",
          otpauthUri: "otpauth://totp/TEST",
        },
      }),
    );
    renderForm(s.fetch);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    await submit();
    expect(screen.getByTestId("enrolment").textContent).toContain(
      "TESTSECRETBASE32",
    );
  });

  it("shows the recovery codes once and continues on request", async () => {
    const s = stub(
      answer(200, {
        status: "signed_in",
        recoveryCodes: ["TEST-RC-1", "TEST-RC-2"],
      }),
    );
    const onSuccess = renderForm(s.fetch, vi.fn(), true);
    fill(/username/i, USER);
    fill(/^password$/i, PASSWORD);
    fill(/one-time code/i, "000000");
    await submit();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByTestId("recovery-codes").textContent).toBe(
      "TEST-RC-1TEST-RC-2",
    );
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("treats a 2xx it cannot read as a refusal and clears the password", async () => {
    const s = stub(
      new Response("not json", { status: 200 }),
      answer(200, { status: "other" }),
    );
    const onSuccess = renderForm(s.fetch);
    for (let i = 0; i < 2; i++) {
      fill(/username/i, USER);
      fill(/^password$/i, PASSWORD);
      await submit();
      expect(screen.getByRole("alert").textContent).toBe(
        "Sign-in refused (status 200)",
      );
      expect(password().value).toBe("");
    }
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("is in Georgian with lang ka", () => {
    renderWithKit(
      <LoginForm action={ACTION} onSuccess={vi.fn()} fetch={stub().fetch} />,
      { lang: "ka" },
    );
    expect(screen.getByRole("button", { name: "შესვლა" })).toBeTruthy();
    expect(screen.getByLabelText("პაროლი")).toBeTruthy();
  });
});

const SESSION: SessionDisplay = {
  sub: "TEST-account-01",
  roles: ["supervisor", "incident_officer"],
  realm: "console",
  exp: 1_900_000_000,
};

function gated(session: SessionDisplay | null, anyOf: string[]) {
  return renderWithKit(
    <SessionProvider session={session}>
      <RequireRole anyOf={anyOf} fallback={<p>fallback</p>}>
        <p>children</p>
      </RequireRole>
    </SessionProvider>,
  );
}

describe("RequireRole", () => {
  it("renders the children when one of several roles matches", () => {
    gated(SESSION, ["admin", "incident_officer"]);
    expect(screen.getByText("children")).toBeTruthy();
    expect(screen.queryByText("fallback")).toBeNull();
  });

  it("renders the fallback when no role matches", () => {
    gated(SESSION, ["admin"]);
    expect(screen.getByText("fallback")).toBeTruthy();
    expect(screen.queryByText("children")).toBeNull();
  });

  it("renders the fallback when roles is empty, and when signed out", () => {
    gated({ ...SESSION, roles: [] }, ["supervisor"]);
    expect(screen.getAllByText("fallback")).toHaveLength(1);
    gated(null, ["supervisor"]);
    expect(screen.getAllByText("fallback")).toHaveLength(2);
    expect(screen.queryByText("children")).toBeNull();
  });

  it("renders nothing without a fallback", () => {
    const view = renderWithKit(
      <SessionProvider session={SESSION}>
        <RequireRole anyOf={["admin"]}>
          <p>children</p>
        </RequireRole>
      </SessionProvider>,
    );
    expect(view.container.textContent).toBe("");
  });
});

function Probe() {
  const { session, signOut } = useSession();
  return (
    <div>
      <p data-testid="sub">{session?.sub ?? "signed out"}</p>
      <button
        type="button"
        onClick={() => void signOut().catch(() => undefined)}
      >
        out
      </button>
    </div>
  );
}

describe("SessionProvider", () => {
  it("signs out through the BFF with the CSRF header, then shows signed out", async () => {
    document.cookie = "uspace_csrf=TEST-csrf-value-01; Path=/";
    const s = stub(new Response(null, { status: 204 }));
    renderWithKit(
      <SessionProvider session={SESSION} fetch={s.fetch}>
        <Probe />
      </SessionProvider>,
    );
    expect(screen.getByTestId("sub").textContent).toBe("TEST-account-01");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "out" }));
    });
    expect(s.calls[0]?.url).toBe("/_bff/logout");
    expect(s.calls[0]?.init.method).toBe("POST");
    expect(new Headers(s.calls[0]?.init.headers).get("X-CSRF-Token")).toBe(
      "TEST-csrf-value-01",
    );
    expect(screen.getByTestId("sub").textContent).toBe("signed out");
  });

  it("keeps the session when the BFF refuses the sign-out", async () => {
    const s = stub(new Response(null, { status: 403 }));
    renderWithKit(
      <SessionProvider
        session={SESSION}
        fetch={s.fetch}
        logoutAction="/custom/logout"
      >
        <Probe />
      </SessionProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "out" }));
    });
    expect(s.calls[0]?.url).toBe("/custom/logout");
    expect(
      new Headers(s.calls[0]?.init.headers).get("X-CSRF-Token"),
    ).toBeNull();
    expect(screen.getByTestId("sub").textContent).toBe("TEST-account-01");
  });

  it("useSession throws without a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderWithKit(<Probe />)).toThrow(/SessionProvider/);
  });
});

describe("csrfToken", () => {
  it("reads the uspace_csrf cookie", () => {
    document.cookie = "other=1; Path=/";
    document.cookie = "uspace_csrf=TEST-csrf-value-01; Path=/";
    expect(csrfToken()).toBe("TEST-csrf-value-01");
  });

  it("is null when the cookie is absent or empty", () => {
    expect(csrfToken()).toBeNull();
    document.cookie = "uspace_csrf=; Path=/";
    expect(csrfToken()).toBeNull();
  });

  it("decodes a percent-encoded value and reads another name", () => {
    document.cookie = "my_csrf=a%2Bb; Path=/";
    expect(csrfToken("my_csrf")).toBe("a+b");
    document.cookie = "bad_csrf=%E0%A4%A; Path=/";
    expect(csrfToken("bad_csrf")).toBe("%E0%A4%A");
  });
});
