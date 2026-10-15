"use client";

// The kit's LoginForm on the BFF's /_bff/login: the password crosses the
// network once and the session token never reaches page script.
import { useRouter } from "next/navigation";
import { BFF_LOGIN_PATH, LoginForm } from "@rootxkit/uspace-ui/auth/client";
import { useT } from "@rootxkit/uspace-ui/i18n";
import { PageHeader, Panel } from "@rootxkit/uspace-ui/ui";

export function LoginPage() {
  const t = useT();
  const router = useRouter();
  return (
    <div className="grid w-full max-w-md gap-4">
      <PageHeader
        title={t("example.login.heading")}
        description={t("example.login.stub_note")}
      />
      <Panel>
        <LoginForm
          action={BFF_LOGIN_PATH}
          onSuccess={() => {
            router.push("/protected");
            router.refresh();
          }}
        />
      </Panel>
    </div>
  );
}
