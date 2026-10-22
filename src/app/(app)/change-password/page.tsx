import type { Metadata } from "next";
import { Suspense } from "react";
import { PasswordForm } from "@/components/auth/password-form";
import { Card, Skeleton } from "@/components/ui/kit";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Change password" };

export default function ChangePasswordPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] text-text-3 max-md:hidden">Account · Change password</span>
        <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em] max-md:hidden">Change password</h1>
        <p className="m-0 text-[14.5px] leading-normal text-text-2 max-md:mt-1 max-md:text-sm">
          You&apos;ll stay signed in on this device. Other devices will be signed out.
        </p>
      </div>
      <Card className="p-7 max-md:px-4 max-md:py-5">
        <Suspense fallback={<Skeleton className="h-72" />}>
          <ChangeForm />
        </Suspense>
      </Card>
    </div>
  );
}

async function ChangeForm() {
  await requireUser();
  return <PasswordForm mode="change" />;
}
