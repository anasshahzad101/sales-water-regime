import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { AuthFrame } from "@/components/auth/auth-frame";
import { PasswordForm } from "@/components/auth/password-form";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/kit";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Set your password" };

export default function SetPasswordPage() {
  return (
    <AuthFrame>
      <span className="flex size-12 items-center justify-center rounded-[14px] bg-brand-soft text-green">
        <Icon name="key-round" size={22} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em]">Set your own password</h1>
        <p className="m-0 text-[15px] leading-normal text-text-2">
          Everyone starts with the same shared password, so you need your own before you can continue.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <SetPasswordBody />
      </Suspense>
    </AuthFrame>
  );
}

async function SetPasswordBody() {
  const user = await requireUser({ allowMustChange: true });
  if (!user.mustChangePassword) redirect(user.isCeo ? "/cockpit" : "/my-week");
  return (
    <>
      <PasswordForm mode="set" />
      <form action={signOut} className="m-0 text-[13px] text-text-3">
        Signed in as {user.email} ·{" "}
        <button type="submit" className="border-0 bg-transparent p-0 font-semibold text-link hover:underline">
          Not you? Sign out
        </button>
      </form>
    </>
  );
}
