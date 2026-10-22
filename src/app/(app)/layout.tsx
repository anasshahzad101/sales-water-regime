import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/dal";
import { outcomeBadge, requestNow } from "@/lib/queries/common";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { now } = await requestNow();
  const badge = user.isCeo ? { count: 0, overdue: 0 } : await outcomeBadge(user.id, now);
  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        initials: user.initials,
        role: user.role,
        roleLabel: user.roleLabel,
        region: user.region,
        isCeo: user.isCeo,
        isAdmin: user.isAdmin,
      }}
      badge={badge}
    >
      {children}
    </AppShell>
  );
}

function ShellFallback() {
  return (
    <div className="min-h-full bg-bg md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r border-nav-line bg-nav-bg md:block" />
      <div className="flex flex-col">
        <div className="hidden h-16 border-b border-line md:block" />
        <div className="h-[52px] md:hidden" />
      </div>
    </div>
  );
}
