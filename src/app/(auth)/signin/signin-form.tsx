"use client";

import { useActionState, useEffect, useState } from "react";
import { signIn, type SigninState } from "@/app/actions/auth";
import { Icon } from "@/components/ui/icon";
import { FieldError } from "@/components/ui/kit";
import { LOGIN_LOCK_MINUTES } from "@/lib/constants";
import { cn } from "@/lib/cn";

const inputBase =
  "wr-field h-12 w-full min-w-0 rounded-xl border bg-input px-3.5 text-base text-ink outline-none placeholder:text-text-3";

export function SigninForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SigninState, FormData>(signIn, {});
  const [show, setShow] = useState(false);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (state.alert !== "locked" || !state.until) return;
    const until = new Date(state.until).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((until - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [state.alert, state.until]);

  const locked = state.alert === "locked" && left > 0;
  const bad = state.alert === "wrong";
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  const alert =
    state.alert === "wrong"
      ? {
          icon: "circle-alert",
          cls: "bg-red-bg text-red",
          title: "Email or password is incorrect",
          text:
            state.attemptsLeft != null
              ? `Check both and try again. After ${state.attemptsLeft} more failed attempt${state.attemptsLeft === 1 ? "" : "s"}, sign-in is locked for ${LOGIN_LOCK_MINUTES} minutes.`
              : "Check both and try again.",
        }
      : state.alert === "locked" && left > 0
        ? {
            icon: "lock",
            cls: "bg-red-bg text-red",
            title: `Too many attempts — try again in ${LOGIN_LOCK_MINUTES} minutes`,
            text: `For your security, sign-in is paused. You can try again in ${mmss}.`,
          }
        : state.alert === "deactivated"
          ? {
              icon: "user-x",
              cls: "bg-amber-bg text-amber",
              title: "This account has been deactivated",
              text: "Your admin can reactivate it. Your visits and deals are kept.",
            }
          : null;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {alert && (
        <div role="alert" className={cn("flex items-start gap-3 rounded-[14px] px-4 py-3.5", alert.cls)}>
          <Icon name={alert.icon} size={18} className="mt-0.5" />
          <div className="flex flex-col gap-[3px]">
            <span className="text-sm font-bold">{alert.title}</span>
            <span className="text-[13.5px] leading-snug text-ink">{alert.text}</span>
          </div>
        </div>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">Email</span>
        <input
          name="email"
          type="email"
          defaultValue={state.email ?? ""}
          key={state.email ?? "email"}
          placeholder="name@waterregime.com"
          autoComplete="username"
          required
          className={cn(inputBase, state.emailErr || bad ? "border-red" : "border-line-strong")}
        />
        {state.emailErr && <FieldError>{state.emailErr}</FieldError>}
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">Password</span>
        <span className="relative flex">
          <input
            name="password"
            type={show ? "text" : "password"}
            placeholder="Your password"
            autoComplete="current-password"
            className={cn(inputBase, "pr-[52px]", bad ? "border-red" : "border-line-strong")}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute top-0.5 right-0.5 flex size-11 items-center justify-center rounded-[10px] border-0 bg-transparent text-text-2"
          >
            <Icon name={show ? "eye-off" : "eye"} size={18} />
          </button>
        </span>
      </label>
      <button
        type="submit"
        disabled={locked || pending}
        className={cn(
          "flex h-[52px] items-center justify-center gap-2.5 rounded-full border-0 text-base font-bold",
          locked
            ? "cursor-not-allowed bg-bg-alt text-text-3"
            : "bg-cta text-on-cta shadow-[0_12px_28px_-12px_rgba(0,169,80,0.75)] hover:bg-cta-hover",
        )}
      >
        {pending && <Icon name="loader-circle" size={18} className="animate-spin" />}
        {pending ? "Signing in…" : locked ? `Locked · ${mmss}` : "Sign in"}
      </button>
      <p className="m-0 text-[13.5px] leading-normal text-text-2">
        Forgot your password? Ask your admin to reset it. You&apos;ll get a temporary one.
      </p>
    </form>
  );
}
