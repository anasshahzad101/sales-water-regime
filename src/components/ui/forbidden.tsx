import { signOut } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth/dal";
import { ErrorScreen } from "./error-page";

/** 403 screen, worded for the user's role. Rendered over the whole viewport. */
export function Forbidden({ user }: { user: CurrentUser }) {
  const home = user.isCeo ? "/cockpit" : "/my-week";
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <ErrorScreen
        code="403"
        title="You don’t have access to this page"
        text={
          user.isCeo
            ? "Your CEO account is read-only and opens from the Cockpit. Use the Cockpit drill-downs to see accounts and deals."
            : "Users and the audit log are only for admins. If you need access, ask your admin."
        }
        primary={{ label: user.isCeo ? "Go to Cockpit" : "Go to My Week", icon: "arrow-left", href: home }}
        secondary={{ label: "Sign in as someone else", icon: "log-out", form: (btn) => <form action={signOut}>{btn}</form> }}
      />
    </div>
  );
}
