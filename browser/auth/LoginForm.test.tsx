import { within } from "@testing-library/react";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import { LoginForm } from "../../src/auth/client/index.js";
import { EN_DARK, EN_LIGHT, KA_DARK, KA_LIGHT, renderKit } from "../kit.js";
import { LOGIN_PROPS } from "./login.js";

// WP-5: the sign-in form in both languages and both schemes, under axe.
// The BFF is a stub answering from fixtures (CLAUDE.md rule 7): no test
// reaches a network, and every value typed is a TEST fixture. The plain
// form in each look is in the golden set (browser/golden/).

const json = (status: number, body: unknown, headers = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type":
        status >= 400 ? "application/problem+json" : "application/json",
      ...headers,
    },
  });

const rateLimited: typeof fetch = () =>
  Promise.resolve(
    json(
      429,
      {
        type: "https://schemas.uspace.ge/problems/rate_limited",
        title: "Too many attempts",
        status: 429,
        detail: "Too many sign-in attempts for this account.",
        instance: null,
        errors: [],
      },
      { "Retry-After": "30" },
    ),
  );

const enrolling: typeof fetch = () =>
  Promise.resolve(
    json(200, {
      status: "mfa_required",
      enrolment: {
        secret: "TESTSECRETBASE32TESTSECRET",
        otpauthUri: "otpauth://totp/TEST",
      },
    }),
  );

async function signIn(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const inputs = canvasElement.querySelectorAll("input");
  await userEvent.type(inputs[0] as HTMLInputElement, "TEST-user-01");
  await userEvent.type(inputs[1] as HTMLInputElement, "TEST-fixture-01");
  await userEvent.click(canvas.getByRole("button"));
}

it("sign-in (en light)", () => {
  const { container } = renderKit(<LoginForm {...LOGIN_PROPS} />, EN_LIGHT);
  expect(within(container).getByRole("button")).toBeEnabled();
});

it("sign-in (ka dark)", () => {
  const { container } = renderKit(<LoginForm {...LOGIN_PROPS} />, KA_DARK);
  expect(within(container).getByRole("button")).toBeEnabled();
});

it("one-time code (en dark)", () => {
  const { container } = renderKit(<LoginForm {...LOGIN_PROPS} mfa />, EN_DARK);
  const otp = within(container).getByLabelText("One-time code");
  expect(otp.getAttribute("autocomplete")).toBe("one-time-code");
});

it("one-time code (ka light)", () => {
  const { container } = renderKit(<LoginForm {...LOGIN_PROPS} mfa />, KA_LIGHT);
  expect(within(container).getByLabelText("ერთჯერადი კოდი")).toBeVisible();
});

/** A 429 from the API: its detail, a countdown, and submit disabled. */
it("rate limited (en light)", async () => {
  const { container } = renderKit(
    <LoginForm {...LOGIN_PROPS} fetch={rateLimited} />,
    EN_LIGHT,
  );
  await signIn(container);
  const canvas = within(container);
  expect(await canvas.findByRole("alert")).toHaveTextContent(
    "Too many sign-in attempts for this account.",
  );
  expect(canvas.getByText(/Try again in \d+ seconds/)).toBeVisible();
  expect(canvas.getByRole("button")).toBeDisabled();
  expect(container.querySelectorAll("input")[1]).toHaveValue("");
});

it("rate limited (ka dark)", async () => {
  const { container } = renderKit(
    <LoginForm {...LOGIN_PROPS} fetch={rateLimited} />,
    KA_DARK,
  );
  await signIn(container);
  const canvas = within(container);
  await canvas.findByRole("alert");
  expect(canvas.getByText(/სცადეთ ხელახლა \d+ წამში/)).toBeVisible();
});

/** The first sign-in of an account: the authenticator key and the code field. */
it("enrolment (en light)", async () => {
  const { container } = renderKit(
    <LoginForm {...LOGIN_PROPS} fetch={enrolling} />,
    EN_LIGHT,
  );
  await signIn(container);
  const canvas = within(container);
  expect(await canvas.findByText("TESTSECRETBASE32TESTSECRET")).toBeVisible();
  expect(canvas.getByLabelText("One-time code")).toBeVisible();
});

it("enrolment (ka dark)", async () => {
  const { container } = renderKit(
    <LoginForm {...LOGIN_PROPS} fetch={enrolling} />,
    KA_DARK,
  );
  await signIn(container);
  const canvas = within(container);
  expect(await canvas.findByText("TESTSECRETBASE32TESTSECRET")).toBeVisible();
  expect(canvas.getByLabelText("ერთჯერადი კოდი")).toBeVisible();
});

const refused: typeof fetch = () =>
  Promise.resolve(
    json(401, {
      type: "https://schemas.uspace.ge/problems/invalid_credentials",
      title: "Refused",
      status: 401,
      detail: "Wrong username or password.",
      instance: null,
      errors: [],
    }),
  );

/**
 * docs/ACCESSIBILITY.md A4: a click on the submit button disables it while
 * the request runs; after the refusal the focus is on the cleared password,
 * not on <body>.
 */
it("refused sign-in returns the focus (en light)", async () => {
  const { container } = renderKit(
    <LoginForm {...LOGIN_PROPS} fetch={refused} />,
    EN_LIGHT,
  );
  await signIn(container);
  const canvas = within(container);
  await canvas.findByRole("alert");
  await expect
    .poll(() => document.activeElement)
    .toBe(canvas.getByLabelText("Password"));
  expect(document.activeElement).not.toBe(document.body);
});

it("refused sign-in returns the focus (ka dark)", async () => {
  const { container } = renderKit(
    <LoginForm {...LOGIN_PROPS} fetch={refused} />,
    KA_DARK,
  );
  await signIn(container);
  const canvas = within(container);
  await canvas.findByRole("alert");
  const passwordField = container.querySelectorAll("input")[1];
  await expect.poll(() => document.activeElement).toBe(passwordField);
});
