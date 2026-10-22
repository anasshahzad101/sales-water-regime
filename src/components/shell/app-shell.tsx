"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/actions/auth";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/kit";
import { cn } from "@/lib/cn";
import { Clock } from "./clock";
import { PageTitleProvider, usePageTitle } from "./page-title";
import { SearchPalette } from "./search-palette";
import { ThemeToggle } from "./theme-toggle";

export type ShellUser = {
  name: string;
  email: string;
  initials: string;
  role: string;
  roleLabel: string;
  region: string | null;
  isCeo: boolean;
  isAdmin: boolean;
};
export type ShellBadge = { count: number; overdue: number };

type NavKey = "myweek" | "visits" | "accounts" | "pulse" | "cockpit" | "users" | "audit" | "log" | null;

const NAV: { key: NavKey; href: string; label: string; icon: string; roles: string[]; divider?: boolean }[] = [
  { key: "myweek", href: "/my-week", label: "My Week", icon: "calendar-check", roles: ["sales", "manager", "admin"] },
  { key: "visits", href: "/visits", label: "Visits", icon: "history", roles: ["sales", "manager", "admin"] },
  { key: "accounts", href: "/accounts", label: "Accounts", icon: "building-2", roles: ["sales", "manager", "admin"] },
  { key: "pulse", href: "/pulse", label: "Team Pulse", icon: "kanban", roles: ["sales", "manager", "admin"] },
  { key: "cockpit", href: "/cockpit", label: "Cockpit", icon: "gauge", roles: ["sales", "manager", "admin", "ceo"] },
  { key: "users", href: "/admin/users", label: "Users", icon: "users-round", roles: ["admin"], divider: true },
  { key: "audit", href: "/admin/audit", label: "Audit log", icon: "scroll-text", roles: ["admin"] },
];

function navKeyFor(path: string): NavKey {
  if (path.startsWith("/my-week")) return "myweek";
  if (path.startsWith("/log")) return "log";
  if (path.startsWith("/visits")) return "visits";
  if (path.startsWith("/accounts")) return "accounts";
  if (path.startsWith("/pulse") || path.startsWith("/deals")) return "pulse";
  if (path.startsWith("/cockpit")) return "cockpit";
  if (path.startsWith("/admin/users")) return "users";
  if (path.startsWith("/admin/audit")) return "audit";
  return null;
}

function metaFor(path: string): { title: string; back?: string } {
  if (path === "/log") return { title: "Log a visit", back: "/my-week" };
  if (path === "/visits") return { title: "Visits" };
  if (path === "/accounts") return { title: "Accounts" };
  if (path === "/accounts/new") return { title: "Add company", back: "/accounts" };
  if (/^\/accounts\/\d+/.test(path)) return { title: "Account", back: "/accounts" };
  if (path === "/pulse") return { title: "Team Pulse" };
  if (path === "/deals/new") return { title: "New deal", back: "/pulse" };
  if (/^\/deals\/\d+/.test(path)) return { title: "Deal", back: "/pulse" };
  if (path === "/cockpit") return { title: "Cockpit" };
  if (path.startsWith("/cockpit/")) return { title: "Flag list", back: "/cockpit" };
  if (path === "/admin/users") return { title: "Users" };
  if (path === "/admin/audit") return { title: "Audit log" };
  if (path === "/change-password") return { title: "Change password", back: "/my-week" };
  return { title: "My Week" };
}

export function AppShell(props: { user: ShellUser; badge: ShellBadge; children: React.ReactNode }) {
  return (
    <PageTitleProvider>
      <ShellInner {...props} />
    </PageTitleProvider>
  );
}

function ShellInner({ user, badge, children }: { user: ShellUser; badge: ShellBadge; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const override = usePageTitle();
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const [search, setSearch] = useState(false);
  const navKey = navKeyFor(path);
  const meta = metaFor(path);
  const title = override?.title ?? meta.title;
  const back = override?.back ?? meta.back;
  const canLog = !user.isCeo;

  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) {
    setLastPath(path);
    setMenu(false);
    setMore(false);
    setSearch(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearch(true);
      } else if ((e.key === "l" || e.key === "L") && canLog) {
        e.preventDefault();
        router.push("/log");
      } else if (e.key === "Escape") {
        setMenu(false);
        setMore(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canLog, router]);

  const items = NAV.filter((n) => n.roles.includes(user.role));
  const badgeTitle = `${badge.count} visit${badge.count === 1 ? "" : "s"} awaiting outcome${badge.overdue ? `, ${badge.overdue} overdue` : ""}`;

  const moreItems = [
    { key: "visits", href: "/visits", label: "Visit history", icon: "history", show: !user.isCeo },
    { key: "cockpit", href: "/cockpit", label: "Cockpit", icon: "gauge", show: true },
    { key: "users", href: "/admin/users", label: "Users", icon: "users-round", show: user.isAdmin },
    { key: "audit", href: "/admin/audit", label: "Audit log", icon: "scroll-text", show: user.isAdmin },
  ].filter((m) => m.show);

  const tabs: { key: string; href?: string; label: string; icon: string; log?: boolean; more?: boolean }[] = [
    { key: "myweek", href: "/my-week", label: "My Week", icon: "calendar-check" },
    { key: "accounts", href: "/accounts", label: "Accounts", icon: "building-2" },
    { key: "log", href: "/log", label: "Log visit", icon: "plus", log: true },
    { key: "pulse", href: "/pulse", label: "Pulse", icon: "kanban" },
    { key: "more", label: "More", icon: "menu", more: true },
  ];

  return (
    <div className="min-h-full bg-bg text-ink md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      {/* ------------------------------------------------ desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-[22px] border-r border-nav-line bg-nav-bg px-3.5 pt-5 pb-4 text-nav-ink md:flex">
        <Link href={user.isCeo ? "/cockpit" : "/my-week"} className="flex items-center gap-2.5 px-2 py-0.5 text-nav-ink hover:text-nav-ink hover:no-underline">
          <img src="/brand/favicon.png" alt="Water Regime" className="block h-[30px] w-auto" />
          <span className="flex flex-col gap-px">
            <span className="font-display text-[17px] leading-[1.1] font-semibold tracking-[-0.01em]">Sales Hub</span>
            <span className="text-[11.5px] text-nav-muted">Water Regime</span>
          </span>
        </Link>
        {canLog && (
          <Link
            href="/log"
            className="flex h-12 items-center gap-2.5 rounded-full bg-cta pr-2.5 pl-[18px] text-[15px] font-semibold text-on-cta shadow-[0_10px_24px_-12px_rgba(0,169,80,0.8)] hover:bg-cta-hover hover:text-on-cta hover:no-underline"
          >
            <Icon name="notebook-pen" size={18} />
            <span className="flex-1">Log a visit</span>
            <span className="flex size-[22px] items-center justify-center rounded-[7px] bg-white/20 text-[11px] font-bold" title="Shortcut: L">
              L
            </span>
          </Link>
        )}
        <nav className="flex flex-col gap-0.5" aria-label="Main">
          {items.map((n) => {
            const active = n.key === navKey;
            return (
              <div key={n.href} className="flex flex-col">
                {n.divider && <span className="px-3.5 pt-3.5 pb-1.5 text-[11px] font-bold tracking-[0.08em] text-nav-muted uppercase">Admin</span>}
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-[42px] items-center gap-3 rounded-xl pr-2.5 pl-3.5 text-sm hover:bg-white/[0.06] hover:no-underline",
                    active ? "bg-nav-active font-semibold text-nav-accent hover:text-nav-accent" : "font-medium text-nav-ink hover:text-nav-ink",
                  )}
                >
                  <Icon name={n.icon} size={18} className={active ? "text-nav-accent" : "text-nav-muted"} />
                  <span className="flex-1">{n.label}</span>
                  {n.key === "myweek" && badge.count > 0 && (
                    <span
                      title={badgeTitle}
                      className={cn(
                        "flex h-5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11.5px] font-bold",
                        badge.overdue ? "bg-red-solid text-on-solid" : "bg-[rgba(159,245,192,0.16)] text-nav-accent",
                      )}
                    >
                      {badge.count}
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="relative mt-auto flex flex-col gap-2.5">
          {user.isCeo && (
            <div className="flex items-start gap-2.5 rounded-[14px] border border-nav-line bg-[rgba(159,245,192,0.06)] p-3 text-[12.5px] leading-[1.45] text-nav-muted">
              <Icon name="eye" size={16} className="mt-0.5 text-nav-accent" />
              <span>
                <b className="text-nav-ink">Read-only access.</b> You can open any record but not change it.
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-haspopup="menu"
            className="flex w-full items-center gap-2.5 rounded-[14px] border border-nav-line bg-white/[0.03] px-2.5 py-2 text-left text-nav-ink"
          >
            <span className="flex size-[34px] flex-none items-center justify-center rounded-full bg-[rgba(159,245,192,0.14)] text-[12.5px] font-bold text-nav-accent">
              {user.initials}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              <span className="truncate text-[13.5px] font-semibold">{user.name}</span>
              <span className="truncate text-xs text-nav-muted">
                {user.roleLabel}
                {user.region ? ` · ${user.region}` : ""}
              </span>
            </span>
            <Icon name="chevrons-up-down" size={16} className="text-nav-muted" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div role="menu" className="absolute bottom-[58px] left-0 z-[41] flex w-[272px] flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-2 text-ink shadow-[var(--shadow-lg)]">
                <div className="mb-1 flex items-center gap-2.5 border-b border-line px-2.5 pt-2.5 pb-3">
                  <Avatar initials={user.initials} size={38} />
                  <span className="flex min-w-0 flex-col gap-px">
                    <span className="text-sm font-semibold">{user.name}</span>
                    <span className="truncate text-[12.5px] text-text-2">{user.email}</span>
                    <span className="text-xs text-text-3">
                      {user.roleLabel}
                      {user.region ? ` · ${user.region}` : ""}
                    </span>
                  </span>
                </div>
                <Link role="menuitem" href="/change-password" className="flex h-10 items-center gap-2.5 rounded-[10px] px-2.5 text-sm text-ink hover:bg-surface-2 hover:text-ink hover:no-underline">
                  <Icon name="key-round" size={16} className="text-text-2" />
                  Change password
                </Link>
                <div className="flex h-11 items-center gap-2.5 pr-1.5 pl-2.5 text-sm">
                  <Icon name="sun-moon" size={16} className="text-text-2" />
                  <span className="flex-1">Theme</span>
                  <ThemeToggle />
                </div>
                <form action={signOut} className="mt-1 border-t border-line pt-1">
                  <button role="menuitem" type="submit" className="flex h-10 w-full items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-2.5 text-left text-sm text-ink hover:bg-surface-2">
                    <Icon name="log-out" size={16} className="text-text-2" />
                    Sign out
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------ main column */}
      <div className="flex min-w-0 flex-col">
        {/* desktop header */}
        <header className="sticky top-0 z-30 hidden h-16 flex-none items-center gap-4 border-b border-line bg-bg/90 px-8 backdrop-blur md:flex">
          <button
            type="button"
            onClick={() => setSearch(true)}
            className="flex h-10 w-[440px] max-w-full items-center gap-2.5 rounded-xl border border-line bg-surface pr-2 pl-3 text-left text-text-3 hover:border-line-strong"
          >
            <Icon name="search" size={16} />
            <span className="flex-1 text-sm">Search companies, brands, plants or deals</span>
            <span className="rounded-md border border-line px-[7px] py-0.5 text-[11.5px] font-semibold text-text-2">/</span>
          </button>
          <span className="ml-auto flex items-center gap-3.5">
            {user.isCeo && (
              <span title="CEO access is view-only" className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[12.5px] font-semibold text-text-2">
                <Icon name="eye" size={14} />
                Read-only
              </span>
            )}
            <span className="flex items-center gap-2 text-[13px] text-text-2">
              <Icon name="clock" size={15} />
              <Clock />
            </span>
          </span>
        </header>

        {/* phone top bar */}
        <div
          className={cn(
            "sticky top-0 z-30 flex h-[52px] flex-none items-center gap-1 bg-bg/95 pr-1.5 backdrop-blur md:hidden",
            back ? "border-b border-line pl-1" : "pl-4",
          )}
        >
          {back ? (
            <Link href={back} aria-label="Back" className="flex size-11 items-center justify-center rounded-full text-ink hover:text-ink">
              <Icon name="chevron-left" size={24} />
            </Link>
          ) : (
            <img src="/brand/favicon.png" alt="Water Regime" className="mr-1.5 block h-6 w-auto" />
          )}
          <span className={cn("min-w-0 flex-1 truncate font-display font-semibold tracking-[-0.01em]", back ? "text-[16.5px]" : "text-lg")}>{title}</span>
          {user.isCeo && (
            <span className="inline-flex h-[26px] items-center gap-[5px] rounded-full border border-line-strong px-2.5 text-xs font-semibold text-text-2">
              <Icon name="eye" size={13} />
              Read-only
            </span>
          )}
          {!back && (
            <button type="button" aria-label="Search" onClick={() => setSearch(true)} className="flex size-11 items-center justify-center rounded-full border-0 bg-transparent text-ink">
              <Icon name="search" size={20} />
            </button>
          )}
          <button type="button" aria-label="Account menu" onClick={() => setMore(true)} className="flex size-11 items-center justify-center rounded-full border-0 bg-transparent">
            <Avatar initials={user.initials} size={34} />
          </button>
        </div>

        <main
          className={cn(
            "w-full flex-1 px-4 pt-2 md:px-8 md:pt-7 md:pb-14",
            user.isCeo ? "pb-7" : "pb-[calc(110px+env(safe-area-inset-bottom))] md:pb-14",
          )}
        >
          {children}
        </main>
      </div>

      {/* ------------------------------------------------ phone tab bar */}
      {!user.isCeo && (
        <nav
          aria-label="Tabs"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-start border-t border-line bg-surface px-1.5 pt-1.5 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden"
        >
          {tabs.map((t) => {
            if (t.log)
              return (
                <Link key={t.key} href="/log" aria-label="Log a visit" className="-mt-6 flex flex-col items-center gap-[3px] text-text-2 hover:text-text-2 hover:no-underline">
                  <span className="flex size-[58px] items-center justify-center rounded-full border-4 border-surface bg-cta text-on-cta shadow-[0_10px_24px_-8px_rgba(0,169,80,0.7)]">
                    <Icon name="plus" size={26} />
                  </span>
                  <span className="text-[11px] font-semibold">Log visit</span>
                </Link>
              );
            const active = t.key === navKey || (t.more && ["visits", "cockpit", "users", "audit"].includes(navKey ?? ""));
            const inner = (
              <>
                <span className="relative flex">
                  <Icon name={t.icon} size={22} />
                  {t.key === "myweek" && badge.count > 0 && (
                    <span
                      className={cn(
                        "absolute -top-[7px] left-3.5 flex h-[18px] min-w-5 items-center justify-center rounded-full border-2 border-surface px-[5px] text-[11px] font-bold",
                        badge.overdue ? "bg-red-solid text-on-solid" : "bg-primary text-on-primary",
                      )}
                    >
                      {badge.count}
                    </span>
                  )}
                </span>
                <span className={cn("text-[11px]", active ? "font-bold" : "font-semibold")}>{t.label}</span>
              </>
            );
            const cls = cn(
              "flex h-[52px] flex-col items-center justify-center gap-[3px] border-0 bg-transparent p-0 hover:no-underline",
              active ? "text-link hover:text-link" : "text-text-2 hover:text-text-2",
            );
            return t.more ? (
              <button key={t.key} type="button" onClick={() => setMore(true)} className={cls}>
                {inner}
              </button>
            ) : (
              <Link key={t.key} href={t.href!} className={cls}>
                {inner}
              </Link>
            );
          })}
        </nav>
      )}

      {/* ------------------------------------------------ phone "More" sheet */}
      {more && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end md:hidden">
          <div className="absolute inset-0 bg-scrim" onClick={() => setMore(false)} />
          <div role="dialog" aria-label="Menu" className="relative flex flex-col gap-1 rounded-t-[28px] bg-surface px-4 pt-2 pb-[calc(30px+env(safe-area-inset-bottom))] text-ink shadow-[var(--shadow-lg)]">
            <div className="mx-auto mb-2.5 h-[5px] w-10 rounded-full bg-line-strong" />
            <div className="flex items-center gap-3 border-b border-line px-1 pt-1 pb-3.5">
              <Avatar initials={user.initials} size={44} />
              <span className="flex flex-1 flex-col gap-px">
                <span className="text-[15.5px] font-semibold">{user.name}</span>
                <span className="text-[13px] text-text-2">
                  {user.roleLabel}
                  {user.region ? ` · ${user.region}` : ""}
                </span>
              </span>
              <button type="button" onClick={() => setMore(false)} aria-label="Close" className="flex size-11 items-center justify-center rounded-full border-0 bg-transparent text-text-2">
                <Icon name="x" size={22} />
              </button>
            </div>
            {moreItems.map((m) => (
              <Link
                key={m.key}
                href={m.href}
                className={cn(
                  "flex min-h-[52px] items-center gap-3.5 rounded-xl px-2 text-[15.5px] font-medium text-ink hover:text-ink hover:no-underline",
                  m.key === navKey ? "bg-surface-2" : "",
                )}
              >
                <Icon name={m.icon} size={20} className="text-text-2" />
                <span className="flex-1">{m.label}</span>
                <Icon name="chevron-right" size={18} className="text-text-3" />
              </Link>
            ))}
            <div className="mt-1 flex min-h-14 items-center gap-3.5 border-t border-line px-2 text-[15.5px]">
              <Icon name="sun-moon" size={20} className="text-text-2" />
              <span className="flex-1">Theme</span>
              <ThemeToggle large />
            </div>
            <Link href="/change-password" className="flex min-h-[52px] items-center gap-3.5 rounded-xl px-2 text-[15.5px] text-ink hover:text-ink hover:no-underline">
              <Icon name="key-round" size={20} className="text-text-2" />
              Change password
            </Link>
            <form action={signOut}>
              <button type="submit" className="flex min-h-[52px] w-full items-center gap-3.5 rounded-xl border-0 bg-transparent px-2 text-left text-[15.5px] font-medium text-red">
                <Icon name="log-out" size={20} />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}

      <SearchPalette open={search} onClose={() => setSearch(false)} />
    </div>
  );
}
