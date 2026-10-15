"use client";

// Display gating with RequireRole: the stub's TEST-operator has the roles
// viewer and auditor, and this page needs the second. It hides, it grants
// nothing: the API decides every request.
import { RequireRole, useSession } from "@rootxkit/uspace-ui/auth/client";
import { useT } from "@rootxkit/uspace-ui/i18n";
import { PageHeader, Panel } from "@rootxkit/uspace-ui/ui";

export function ProtectedPage() {
  const t = useT();
  const { session } = useSession();
  return (
    <>
      <PageHeader title={t("example.protected.heading")} />
      <Panel className="max-w-2xl">
        <RequireRole
          anyOf={["auditor"]}
          fallback={
            <p data-testid="protected-fallback" className="m-0">
              {session === null
                ? t("example.protected.signed_out")
                : t("example.protected.denied")}
            </p>
          }
        >
          <p data-testid="protected-body" className="m-0">
            {t("example.protected.body")}
          </p>
        </RequireRole>
      </Panel>
    </>
  );
}
