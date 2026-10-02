import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { LoginForm } from "../../src/auth/client/index.js";

// WP-5: the sign-in form in both languages and both schemes, under axe.
// The BFF is a stub answering from fixtures (CLAUDE.md rule 7): no story
// reaches a network, and every value typed is a TEST fixture.

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

const never: typeof fetch = () => new Promise<Response>(() => undefined);

const meta = {
  title: "auth/LoginForm",
  component: LoginForm,
  args: { action: "/_bff/login", onSuccess: () => undefined, fetch: never },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

async function signIn(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const inputs = canvasElement.querySelectorAll("input");
  await userEvent.type(inputs[0] as HTMLInputElement, "TEST-user-01");
  await userEvent.type(inputs[1] as HTMLInputElement, "TEST-fixture-01");
  await userEvent.click(canvas.getByRole("button"));
}

export const LoginEnglishLight: Story = {
  globals: { lang: "en", scheme: "light" },
};

export const LoginGeorgianDark: Story = {
  globals: { lang: "ka", scheme: "dark" },
};

export const MfaEnglishDark: Story = {
  args: { mfa: true },
  globals: { lang: "en", scheme: "dark" },
  play: async ({ canvasElement }) => {
    const otp = within(canvasElement).getByLabelText("One-time code");
    await expect(otp.getAttribute("autocomplete")).toBe("one-time-code");
  },
};

export const MfaGeorgianLight: Story = {
  args: { mfa: true },
  globals: { lang: "ka", scheme: "light" },
};

/** A 429 from the API: its detail, a countdown, and submit disabled. */
export const RateLimitedEnglishLight: Story = {
  args: { fetch: rateLimited },
  globals: { lang: "en", scheme: "light" },
  play: async ({ canvasElement }) => {
    await signIn(canvasElement);
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Too many sign-in attempts for this account.",
    );
    await expect(canvas.getByText(/Try again in \d+ seconds/)).toBeVisible();
    await expect(canvas.getByRole("button")).toBeDisabled();
    await expect(canvasElement.querySelectorAll("input")[1]).toHaveValue("");
  },
};

export const RateLimitedGeorgianDark: Story = {
  ...RateLimitedEnglishLight,
  globals: { lang: "ka", scheme: "dark" },
  play: async ({ canvasElement }) => {
    await signIn(canvasElement);
    const canvas = within(canvasElement);
    await canvas.findByRole("alert");
    await expect(canvas.getByText(/სცადეთ ხელახლა \d+ წამში/)).toBeVisible();
  },
};

/** The first sign-in of an account: the authenticator key and the code field. */
export const EnrolmentEnglishLight: Story = {
  args: { fetch: enrolling },
  globals: { lang: "en", scheme: "light" },
  play: async ({ canvasElement }) => {
    await signIn(canvasElement);
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("TESTSECRETBASE32TESTSECRET"),
    ).toBeVisible();
    await expect(canvas.getByLabelText("One-time code")).toBeVisible();
  },
};

export const EnrolmentGeorgianDark: Story = {
  args: { fetch: enrolling },
  globals: { lang: "ka", scheme: "dark" },
  play: async ({ canvasElement }) => {
    await signIn(canvasElement);
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("TESTSECRETBASE32TESTSECRET"),
    ).toBeVisible();
    await expect(canvas.getByLabelText("ერთჯერადი კოდი")).toBeVisible();
  },
};
