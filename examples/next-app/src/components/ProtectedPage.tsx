"use client";

// Display gating with RequireRole: the stub's TEST-operator has the roles
// viewer and auditor, and this page needs the second. It hides, it grants
// nothing: the API decides every request.
import { RequireRole, useSession } from "@rootxkit/uspace-ui/auth/client";
import { useT } from "@rootxkit/uspace-ui/i18n";

export function ProtectedPage() {
  const t = useT();
  const { session } = useSession();
  return (
    <section
      aria-labelledby="protected-heading"
      className="flex flex-col gap-3"
    >
      <h1 id="protected-heading" className="text-xl font-bold">
        {t("example.protected.heading")}
      </h1>
      <RequireRole
        anyOf={["auditor"]}
        fallback={
          <p data-testid="protected-fallback">
            {session === null
              ? t("example.protected.signed_out")
              : t("example.protected.denied")}
          </p>
        }
      >
        <p data-testid="protected-body">{t("example.protected.body")}</p>
      </RequireRole>
    </section>
  );
}
