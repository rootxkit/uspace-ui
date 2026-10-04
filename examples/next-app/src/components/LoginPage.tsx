"use client";

// The kit's LoginForm on the BFF's /_bff/login: the password crosses the
// network once and the session token never reaches page script.
import { useRouter } from "next/navigation";
import { BFF_LOGIN_PATH, LoginForm } from "@rootxkit/uspace-ui/auth/client";
import { useT } from "@rootxkit/uspace-ui/i18n";

export function LoginPage() {
  const t = useT();
  const router = useRouter();
  return (
    <section
      aria-labelledby="login-heading"
      className="flex max-w-md flex-col gap-3"
    >
      <h1 id="login-heading" className="text-xl font-bold">
        {t("example.login.heading")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("example.login.stub_note")}
      </p>
      <LoginForm
        action={BFF_LOGIN_PATH}
        onSuccess={() => {
          router.push("/protected");
          router.refresh();
        }}
      />
    </section>
  );
}
