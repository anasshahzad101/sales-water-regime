"use client";

import { useState, useTransition } from "react";
import { changeUserRole, createUser, resetUserPassword, setUserActive } from "@/app/actions/admin";
import { Icon } from "@/components/ui/icon";
import { Avatar, FieldError } from "@/components/ui/kit";
import { Drawer } from "@/components/ui/overlay";
import { hueClass, Pill } from "@/components/ui/pills";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { ROLES, type Hue } from "@/lib/constants";
import type { AdminUserRow } from "@/lib/queries/admin";

const DESC: Record<string, string> = {
  sales: "Logs visits; manages their own accounts and deals.",
  manager: "Everything Sales can do, plus sees and edits the whole team’s data.",
  ceo: "Read-only. Opens on the Cockpit. No edit controls anywhere.",
  admin: "Everything, plus users and the audit log.",
};
const ROLE_PILL: Record<string, [Hue, string]> = {
  sales: ["slate", "user"],
  manager: ["blue", "users"],
  ceo: ["violet", "eye"],
  admin: ["aqua", "shield"],
};

const ALPH = "abcdefghjkmnpqrstuvwxyz23456789";
function genTemp() {
  const r = crypto.getRandomValues(new Uint32Array(8));
  const part = (from: number, upper: boolean) =>
    Array.from(r.slice(from, from + 4), (n) => {
      const ch = ALPH[n % ALPH.length];
      return upper ? ch.toUpperCase() : ch;
    }).join("");
  return `Wr-${part(0, false)}-${part(4, true)}`;
}

function RolePill({ role, label }: { role: string; label: string }) {
  const [hue, icon] = ROLE_PILL[role] ?? ["slate", "user"];
  return (
    <span className={cn("inline-flex h-6 flex-none items-center gap-[5px] rounded-full pr-[9px] pl-2 text-[12.5px] font-semibold whitespace-nowrap", hueClass(hue))}>
      <Icon name={icon} size={12} />
      {label}
    </span>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <Pill hue="green" icon="circle-check">
      Active
    </Pill>
  ) : (
    <Pill hue="slate" icon="circle-slash">
      Inactive
    </Pill>
  );
}

type Overlay =
  | { type: "add"; name: string; email: string; role: string; region: string; temp: string }
  | { type: "role"; id: number; role: string }
  | { type: "reset"; id: number; temp: string };

const inputCls = "wr-field h-12 rounded-xl border bg-input px-3 text-base text-ink outline-none md:h-11 md:text-[14.5px] placeholder:text-text-3";

export function UsersView({ users, regions, activeCount }: { users: AdminUserRow[]; regions: string[]; activeCount: number }) {
  const toast = useToast();
  const [menu, setMenu] = useState<number | null>(null);
  const [ov, setOv] = useState<Overlay | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, startTransition] = useTransition();

  const target = ov && ov.type !== "add" ? users.find((u) => u.id === ov.id) : undefined;
  const close = () => {
    setOv(null);
    setErrs({});
  };

  const openAdd = () => {
    setErrs({});
    setOv({ type: "add", name: "", email: "", role: "sales", region: "Lahore", temp: genTemp() });
  };

  const toggleActive = (u: AdminUserRow) => {
    setMenu(null);
    if (u.isMe) return;
    startTransition(async () => {
      const res = await setUserActive(u.id, !u.isActive);
      if (!res.ok) return toast({ title: "Couldn’t update", sub: res.error, tone: "error" });
      toast({
        title: u.isActive ? "User deactivated" : "User activated",
        sub: u.isActive ? `${u.name} can no longer sign in` : `${u.name} can sign in again`,
        undo: async () => {
          const back = await setUserActive(u.id, u.isActive);
          if (!back.ok) toast({ title: "Couldn’t undo", sub: back.error, tone: "error" });
        },
      });
    });
  };

  const copyTemp = async (temp: string) => {
    try {
      await navigator.clipboard.writeText(temp);
      toast({ title: "Copied", sub: "Temporary password copied to clipboard", tone: "info", ms: 2500 });
    } catch {
      toast({ title: "Couldn’t copy", sub: "Select the password and copy it by hand.", tone: "warning", ms: 4000 });
    }
  };

  const confirm = () => {
    if (!ov) return;
    if (ov.type === "add") {
      const e: Record<string, string> = {};
      if (!ov.name.trim()) e.name = "Enter their name.";
      if (!/^[^\s@]+@waterregime\.com$/i.test(ov.email.trim())) e.email = "Use a @waterregime.com address.";
      if (Object.keys(e).length) return setErrs(e);
    }
    startTransition(async () => {
      if (ov.type === "add") {
        const res = await createUser({ name: ov.name, email: ov.email, role: ov.role, region: ov.region, tempPassword: ov.temp });
        if (!res.ok) {
          if (res.fieldErrors) setErrs(res.fieldErrors);
          else toast({ title: "Couldn’t add user", sub: res.error, tone: "error" });
          return;
        }
        close();
        toast({ title: "User added", sub: `${res.data!.name} · temporary password set` });
      } else if (ov.type === "role") {
        const res = await changeUserRole(ov.id, ov.role);
        if (!res.ok) return toast({ title: "Couldn’t change role", sub: res.error, tone: "error" });
        close();
        toast({ title: "Role changed", sub: `${res.data!.name}: ${res.data!.from} → ${res.data!.to}` });
      } else {
        const res = await resetUserPassword(ov.id, ov.temp);
        if (!res.ok) return toast({ title: "Couldn’t reset password", sub: res.error, tone: "error" });
        close();
        toast({ title: "Password reset", sub: `${res.data!.name} must change it at next sign-in` });
      }
    });
  };

  const curRole = ov ? (ov.type === "reset" ? null : ov.role) : null;
  const summary = `${users.length} users · ${activeCount} active · roles control what each person can see and change`;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end gap-3">
        <div className="hidden min-w-[260px] flex-1 flex-col gap-1.5 md:flex">
          <span className="text-[13px] text-text-3">Admin</span>
          <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em]">Users</h1>
          <p className="m-0 text-[14.5px] text-text-2">{summary}</p>
        </div>
        <p className="m-0 flex-[1_1_100%] text-sm text-text-2 md:hidden">{summary}</p>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full border-0 bg-primary px-[18px] text-sm font-semibold text-on-primary hover:bg-primary-hover md:h-10 md:flex-none"
        >
          <Icon name="user-plus" size={16} />
          Add user
        </button>
      </div>

      <div className="rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_120px_110px_100px_110px_44px] gap-3.5 rounded-t-[18px] bg-surface-2 px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase md:grid">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Region</span>
          <span>Status</span>
          <span>Created</span>
          <span />
        </div>
        {users.map((u, i) => (
          <div
            key={u.id}
            className={cn(
              "relative grid grid-cols-[minmax(0,1fr)_44px] items-center gap-x-2.5 gap-y-2 py-3 pr-3 pl-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_120px_110px_100px_110px_44px] md:gap-3.5 md:px-5 md:py-[11px]",
              i > 0 && "border-t border-line",
              !u.isActive && "opacity-70",
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar initials={u.initials} size={32} />
              <span className="flex min-w-0 flex-col gap-px">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="truncate">{u.name}</span>
                  {u.isMe && <span className="inline-flex h-[18px] flex-none items-center rounded-full bg-aqua-bg px-1.5 text-[11px] font-bold text-aqua">You</span>}
                </span>
                <span className="truncate text-[12.5px] text-text-2 md:hidden">{u.email}</span>
              </span>
            </span>
            <span className="hidden truncate text-[13.5px] text-text-2 md:block" title={u.email}>
              {u.email}
            </span>
            <span className="col-start-1 flex flex-wrap items-center gap-1.5 md:col-start-auto">
              <RolePill role={u.role} label={u.roleLabel} />
              <span className="contents md:hidden">
                <StatusPill active={u.isActive} />
                {u.region && <span className="text-[12.5px] text-text-3">{u.region}</span>}
              </span>
            </span>
            <span className="hidden text-[13.5px] md:block">{u.region ?? "—"}</span>
            <span className="hidden md:block">
              <StatusPill active={u.isActive} />
            </span>
            <span className="hidden text-[13.5px] text-text-2 tabular-nums md:block" title={u.lastLogin ? `Last sign-in ${u.lastLogin}` : "Hasn’t signed in yet"}>
              {u.created}
            </span>
            <button
              type="button"
              onClick={() => setMenu(menu === u.id ? null : u.id)}
              aria-label={`Actions for ${u.name}`}
              aria-haspopup="menu"
              aria-expanded={menu === u.id}
              className={cn(
                "col-start-2 row-start-1 flex size-10 items-center justify-center justify-self-end rounded-full border-0 text-text-2 hover:bg-surface-2 md:col-start-auto md:row-start-auto",
                menu === u.id ? "bg-surface-2" : "bg-transparent",
              )}
            >
              <Icon name="ellipsis" size={18} />
            </button>
            {menu === u.id && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                <div role="menu" className="absolute top-[calc(100%-8px)] right-4 z-20 flex w-[250px] flex-col rounded-[14px] border border-line bg-surface p-1.5 shadow-[var(--shadow-lg)]">
                  <MenuItem
                    icon="shield"
                    label="Change role"
                    disabled={u.isMe}
                    note={u.isMe ? "You can’t change your own role" : undefined}
                    onClick={() => {
                      setMenu(null);
                      setOv({ type: "role", id: u.id, role: u.role });
                    }}
                  />
                  <MenuItem
                    icon="key-round"
                    label="Reset password"
                    disabled={u.isMe}
                    note={u.isMe ? "Use Change password for your own account" : undefined}
                    onClick={() => {
                      setMenu(null);
                      setOv({ type: "reset", id: u.id, temp: genTemp() });
                    }}
                  />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => toggleActive(u)}
                    disabled={u.isMe || busy}
                    title={u.isMe ? "You can’t deactivate yourself" : undefined}
                    className={cn(
                      "mt-1 flex min-h-10 items-center gap-2.5 rounded-b-[10px] border-0 border-t border-line bg-transparent px-2.5 py-1.5 text-left text-sm",
                      u.isMe ? "cursor-not-allowed text-text-3" : u.isActive ? "text-red hover:bg-red-bg" : "text-green hover:bg-green-bg",
                    )}
                  >
                    <Icon name={u.isActive ? "user-x" : "user-check"} size={16} />
                    <span className="flex flex-col gap-px">
                      <span>{u.isActive ? "Deactivate" : "Activate"}</span>
                      {u.isMe && <span className="text-xs text-text-3">You can&apos;t deactivate yourself</span>}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <Drawer
        open={!!ov}
        onClose={close}
        width={460}
        title={!ov ? "" : ov.type === "add" ? "Add user" : ov.type === "role" ? "Change role" : "Reset password"}
        description={!ov ? undefined : ov.type === "add" ? "They sign in with the temporary password and choose their own." : target ? `${target.name} · ${target.email}` : undefined}
        footer={
          <>
            <button type="button" onClick={close} className="h-[50px] flex-1 rounded-full border border-line-strong bg-surface text-[14.5px] font-semibold text-ink hover:bg-surface-2 md:h-11">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy}
              className="inline-flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full border-0 bg-primary text-[14.5px] font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 md:h-11"
            >
              {busy && <Icon name="loader-circle" size={16} className="animate-spin" />}
              {!ov ? "" : ov.type === "add" ? "Add user" : ov.type === "role" ? "Save role" : "Reset password"}
            </button>
          </>
        }
      >
        {ov && (
          <div className="flex flex-col gap-4">
            {ov.type === "add" && (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13.5px] font-semibold">Name *</span>
                  <input
                    value={ov.name}
                    onChange={(e) => {
                      setOv({ ...ov, name: e.target.value });
                      setErrs({});
                    }}
                    placeholder="Full name"
                    autoComplete="off"
                    className={cn(inputCls, errs.name ? "border-red" : "border-line-strong")}
                  />
                  {errs.name && <FieldError>{errs.name}</FieldError>}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13.5px] font-semibold">Email *</span>
                  <input
                    type="email"
                    value={ov.email}
                    onChange={(e) => {
                      setOv({ ...ov, email: e.target.value });
                      setErrs({});
                    }}
                    placeholder="name@waterregime.com"
                    autoComplete="off"
                    className={cn(inputCls, errs.email ? "border-red" : "border-line-strong")}
                  />
                  {errs.email && <FieldError>{errs.email}</FieldError>}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13.5px] font-semibold">Region</span>
                  <span className="relative flex">
                    <select
                      value={ov.region}
                      onChange={(e) => setOv({ ...ov, region: e.target.value })}
                      className={cn(inputCls, "flex-1 appearance-none border-line-strong pr-[38px]")}
                    >
                      {regions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <Icon name="chevron-down" size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-3" />
                  </span>
                </label>
              </>
            )}

            {curRole && (
              <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Role">
                <span className="text-[13.5px] font-semibold">Role</span>
                {ROLES.map((r) => {
                  const on = curRole === r.key;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => ov.type !== "reset" && setOv({ ...ov, role: r.key })}
                      className={cn("flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-ink", on ? "border-primary bg-brand-soft" : "border-line-strong bg-surface hover:bg-surface-2")}
                    >
                      <Icon name={on ? "circle-dot" : "circle"} size={17} className={cn("mt-0.5", on ? "text-green" : "text-text-3")} />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold">{r.label}</span>
                        <span className="text-[12.5px] leading-[1.4] text-text-2">{DESC[r.key]}</span>
                      </span>
                    </button>
                  );
                })}
                {errs.role && <FieldError>{errs.role}</FieldError>}
              </div>
            )}

            {ov.type !== "role" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13.5px] font-semibold">Temporary password</span>
                <span className="flex h-12 items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2 pr-1.5 pl-3.5 md:h-11">
                  <span className="flex-1 truncate font-mono text-[15px] font-semibold tracking-[0.04em] select-all">{ov.temp}</span>
                  <button
                    type="button"
                    onClick={() => setOv({ ...ov, temp: genTemp() })}
                    aria-label="Generate a new one"
                    title="Generate a new one"
                    className="flex size-9 items-center justify-center rounded-full border-0 bg-transparent text-text-2 hover:bg-surface"
                  >
                    <Icon name="refresh-cw" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => copyTemp(ov.temp)}
                    className="flex h-9 items-center gap-1.5 rounded-full border-0 bg-brand-soft px-3 text-[13px] font-bold text-green"
                  >
                    <Icon name="copy" size={14} />
                    Copy
                  </button>
                </span>
                {errs.temp && <FieldError>{errs.temp}</FieldError>}
                <span className="text-[12.5px] leading-[1.45] text-text-3">
                  They&apos;ll be asked to choose their own password at their next sign-in. Share it in person or by phone, not by email.
                </span>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function MenuItem({ icon, label, note, disabled, onClick }: { icon: string; label: string; note?: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-2.5 py-1.5 text-left text-sm",
        disabled ? "cursor-not-allowed text-text-3" : "text-ink hover:bg-surface-2",
      )}
    >
      <Icon name={icon} size={16} className={disabled ? "text-text-3" : "text-text-2"} />
      <span className="flex flex-col gap-px">
        <span>{label}</span>
        {note && <span className="text-xs text-text-3">{note}</span>}
      </span>
    </button>
  );
}
