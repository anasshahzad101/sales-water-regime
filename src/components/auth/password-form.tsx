"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { changePassword, setOwnPassword, type PasswordState } from "@/app/actions/auth";
import { Icon } from "@/components/ui/icon";
import { FieldError } from "@/components/ui/kit";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { passwordStrength } from "@/lib/password-rules";

const BAR = ["var(--line)", "var(--red-solid)", "var(--amber-solid)", "var(--green-solid)", "var(--green-solid)"];
const STRENGTH_FG: Record<string, string> = { "Too short": "var(--red)", Weak: "var(--amber)", Good: "var(--green)", Strong: "var(--green)" };

const input =
  "wr-field w-full min-w-0 rounded-xl border bg-input px-3.5 text-ink outline-none h-11 text-[14.5px] max-md:h-12 max-md:text-base";

export function PasswordForm({ mode }: { mode: "set" | "change" }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(mode === "set" ? setOwnPassword : changePassword, {});
  const [cur, setCur] = useState("");
  const [np, setNp] = useState("");
  const [cp, setCp] = useState("");
  const [show, setShow] = useState(false);
  const [tried, setTried] = useState(false);
  const [localCurErr, setLocalCurErr] = useState("");
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      toast({ title: "Password updated", sub: mode === "set" ? "Welcome to WR Sales Hub" : "Other devices have been signed out" });
      router.replace(state.redirectTo);
      router.refresh();
    }
  }, [state, mode, router, toast]);

  const st = passwordStrength(np);
  const mismatch = !!cp && np !== cp;
  const match = !!cp && np === cp && st.n >= 2;
  const curErr = localCurErr || state.curErr;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        setTried(true);
        if (mode === "change" && !cur) {
          e.preventDefault();
          setLocalCurErr("Enter your current password.");
          return;
        }
        if (st.n < 2 || np !== cp) e.preventDefault();
      }}
      className="flex flex-col gap-[18px]"
    >
      {state.error && <FieldError>{state.error}</FieldError>}
      {mode === "change" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">Current password</span>
          <input
            name="current"
            type="password"
            autoComplete="current-password"
            value={cur}
            onChange={(e) => {
              setCur(e.target.value);
              setLocalCurErr("");
            }}
            className={cn(input, curErr ? "border-red" : "border-line-strong")}
          />
          {curErr && <FieldError>{curErr}</FieldError>}
        </label>
      )}
      <label className="flex flex-col gap-2">
        <span className="text-[13.5px] font-semibold">New password</span>
        <span className="relative flex">
          <input
            name="new"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={np}
            onChange={(e) => setNp(e.target.value)}
            className={cn(input, "pr-[52px]", (tried && st.n < 2) || state.npErr ? "border-red" : "border-line-strong")}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-0.5 right-0.5 flex size-10 items-center justify-center rounded-[10px] border-0 bg-transparent text-text-2 max-md:size-11"
          >
            <Icon name={show ? "eye-off" : "eye"} size={18} />
          </button>
        </span>
        <span className="grid grid-cols-4 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className="h-[5px] rounded-full" style={{ background: i <= st.n ? BAR[st.n] : "var(--line)" }} />
          ))}
        </span>
        <span className="flex justify-between text-[12.5px]">
          <span className="text-text-3">At least 8 characters. Mix letters, numbers and a symbol to make it strong.</span>
          <span className="ml-3 font-bold whitespace-nowrap" style={{ color: STRENGTH_FG[st.label] ?? "var(--text-3)" }}>
            {st.label}
          </span>
        </span>
        {state.npErr && <FieldError>{state.npErr}</FieldError>}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">Confirm new password</span>
        <input
          name="confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={cp}
          onChange={(e) => setCp(e.target.value)}
          className={cn(input, mismatch && (tried || cp.length >= np.length) ? "border-red" : "border-line-strong")}
        />
        {(mismatch || match) && (
          <span className={cn("flex items-center gap-1.5 text-[13px] font-medium", mismatch ? "text-red" : "text-green")}>
            <Icon name={mismatch ? "circle-alert" : "circle-check"} size={14} />
            {mismatch ? "Passwords don’t match yet." : "Passwords match."}
          </span>
        )}
      </label>
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 items-center justify-center gap-2 rounded-full border-0 bg-primary px-[22px] text-[15px] font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 max-md:h-[52px] max-md:flex-1"
        >
          <Icon name={pending ? "loader-circle" : "check"} size={16} className={pending ? "animate-spin" : undefined} />
          {mode === "set" ? "Save and continue" : "Update password"}
        </button>
        {mode === "change" && (
          <Link
            href="/my-week"
            className="flex h-11 items-center rounded-full px-4 text-[14.5px] font-semibold text-text-2 hover:bg-surface-2 hover:text-ink hover:no-underline"
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
