"use client";
// The sign-in form (docs/PLAN.md §3.16; spec 06 §3; LESSONS S-15, B-10).
// It posts JSON to the BFF's login route; the BFF talks to the API and
// sets the cookies, so the page never holds the session token. Values go
// in the request body only, never in a URL; the password is never logged
// and is cleared on every refusal. Rate limits are the API's: a 429 shows
// the API's `detail` and counts its `Retry-After` down, with the submit
// button disabled until it reaches zero.
//
// Two steps when the API asks for a one-time code: the first request
// carries `{username, password}`, the second `{otp}` alone. The BFF keeps
// the API's challenge in an `HttpOnly` cookie between them, and the form
// drops the password from its state as soon as the first step succeeds.
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { retryAfterSOf } from "../../api/error.js";
import { parseProblem, problemSlug } from "../../api/problem.js";
import { useT } from "../../i18n/I18nProvider.js";
import { Button } from "../../ui/button.js";
import { Input } from "../../ui/input.js";
import { Label } from "../../ui/label.js";
import type { LoginResult } from "../contract.js";

/** Display-only constant: the countdown's tick. */
const TICK_MS = 1000;

export interface LoginFormProps {
  /** The BFF's login route, e.g. `/_bff/login`. */
  action: string;
  /** Show the one-time code field from the start (an MFA-only console). */
  mfa?: boolean;
  /** Called once signed in (after the recovery codes, when there were any). */
  onSuccess(): void;
  /** The fetch to use; the platform's by default. */
  fetch?: typeof fetch;
}

type Message = { kind: "error" | "info"; text: string } | null;
type Step = "password" | "otp";
type Outcome = "signed_in" | "mfa_required" | "refused";

function isLoginResult(v: unknown): v is LoginResult {
  if (typeof v !== "object" || v === null) return false;
  const status = (v as { status?: unknown }).status;
  return status === "signed_in" || status === "mfa_required";
}

export function LoginForm(props: LoginFormProps): ReactNode {
  const { action, onSuccess } = props;
  const t = useT();
  const id = useId();
  const otpRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("password");
  const [enrolKey, setEnrolKey] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [retryS, setRetryS] = useState(0);
  const [busy, setBusy] = useState(false);

  // One interval for the whole countdown, stopped when it reaches zero.
  const counting = retryS > 0;
  useEffect(() => {
    if (!counting) return undefined;
    const timer = setInterval(
      () => setRetryS((s) => Math.max(0, s - 1)),
      TICK_MS,
    );
    return () => clearInterval(timer);
  }, [counting]);

  function restart(text: Message = null): void {
    setStep("password");
    setOtp("");
    setEnrolKey(null);
    setMessage(text);
  }

  /** One request to the BFF and what came of it. */
  async function send(body: object, sent: Step): Promise<Outcome> {
    const refuse = (text: string): Outcome => {
      if (sent === "password") setPassword("");
      setOtp("");
      setMessage({ kind: "error", text });
      return "refused";
    };
    let res: Response;
    try {
      res = await (props.fetch ?? fetch)(action, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, application/problem+json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      return refuse(t("auth.unreachable"));
    }
    if (!res.ok) {
      const problem = await parseProblem(res.clone());
      const text =
        problem?.detail ??
        problem?.title ??
        t("auth.failed", { status: res.status });
      const wait = retryAfterSOf(res.headers.get("Retry-After"), Date.now());
      if (wait !== null && wait > 0) setRetryS(wait);
      // The challenge is gone (expired, or never set): start again.
      if (
        sent === "otp" &&
        problem !== null &&
        problemSlug(problem.type) === "mfa_challenge_missing"
      ) {
        restart({ kind: "error", text });
        return "refused";
      }
      return refuse(text);
    }
    let result: unknown = null;
    try {
      result = await res.json();
    } catch {
      result = null;
    }
    if (!isLoginResult(result)) {
      return refuse(t("auth.failed", { status: res.status }));
    }
    if (result.status === "mfa_required") {
      // The password has done its work; it is not sent again.
      setPassword("");
      setStep("otp");
      setEnrolKey(result.enrolment?.secret ?? null);
      setMessage({ kind: "info", text: t("auth.mfa_required") });
      queueMicrotask(() => otpRef.current?.focus());
      return "mfa_required";
    }
    setPassword("");
    setOtp("");
    if (result.recoveryCodes !== undefined && result.recoveryCodes.length > 0) {
      setRecoveryCodes(result.recoveryCodes);
    } else {
      onSuccess();
    }
    return "signed_in";
  }

  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (busy || retryS > 0) return;
    setBusy(true);
    setMessage(null);
    try {
      if (step === "otp") {
        await send({ otp }, "otp");
        return;
      }
      const outcome = await send({ username, password }, "password");
      // An MFA-only console may have the code typed already: send it
      // alone, as the second step.
      if (outcome === "mfa_required" && otp !== "") await send({ otp }, "otp");
    } finally {
      setBusy(false);
    }
  }

  if (recoveryCodes !== null) {
    return (
      <section
        aria-labelledby={`${id}-rc`}
        className="flex max-w-sm flex-col gap-3"
      >
        <p id={`${id}-rc`} className="m-0 text-sm">
          {t("auth.recovery_codes")}
        </p>
        <ul
          className="m-0 grid grid-cols-2 gap-1 p-0 font-mono text-sm"
          data-testid="recovery-codes"
        >
          {recoveryCodes.map((c) => (
            <li key={c} className="list-none">
              {c}
            </li>
          ))}
        </ul>
        <Button type="button" onClick={onSuccess}>
          {t("auth.continue")}
        </Button>
      </section>
    );
  }

  const disabled = busy || retryS > 0;
  return (
    <form
      method="post"
      action={action}
      onSubmit={(e) => void submit(e)}
      aria-labelledby={`${id}-title`}
      className="flex max-w-sm flex-col gap-3"
    >
      <h2 id={`${id}-title`} className="m-0 text-lg font-semibold">
        {t("auth.title")}
      </h2>
      {step === "password" && (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-user`}>{t("auth.username")}</Label>
            <Input
              id={`${id}-user`}
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-password`}>{t("auth.password")}</Label>
            <Input
              id={`${id}-password`}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </>
      )}
      {enrolKey !== null && (
        <div className="flex flex-col gap-1 text-sm" data-testid="enrolment">
          <p className="m-0">{t("auth.enrol")}</p>
          <p className="m-0">
            {t("auth.enrol_key")}:{" "}
            <code className="font-mono break-all">{enrolKey}</code>
          </p>
        </div>
      )}
      {(step === "otp" || props.mfa === true) && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-otp`}>{t("auth.otp")}</Label>
          <Input
            ref={otpRef}
            id={`${id}-otp`}
            name="otp"
            autoComplete="one-time-code"
            inputMode="numeric"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
        </div>
      )}
      {message !== null && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={
            message.kind === "error"
              ? "m-0 text-sm text-destructive"
              : "m-0 text-sm"
          }
        >
          {message.text}
        </p>
      )}
      {retryS > 0 && (
        <p role="status" className="m-0 text-sm" data-testid="retry-countdown">
          {t("auth.retry_in", { count: retryS })}
        </p>
      )}
      <Button type="submit" disabled={disabled}>
        {busy ? t("auth.submitting") : t("auth.submit")}
      </Button>
      {step === "otp" && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => restart()}
        >
          {t("auth.restart")}
        </Button>
      )}
    </form>
  );
}
