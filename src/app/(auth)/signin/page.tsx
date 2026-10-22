import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Skeleton } from "@/components/ui/kit";
import { getCurrentUser } from "@/lib/auth/dal";
import { SigninForm } from "./signin-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SigninPage({ searchParams }: PageProps<"/signin">) {
  return (
    <AuthFrame>
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em]">Sign in</h1>
        <p className="m-0 text-[15px] text-text-2">Use your Water Regime email address.</p>
      </div>
      <Suspense fallback={<FormSkeleton />}>
        <SigninGate searchParams={searchParams} />
      </Suspense>
    </AuthFrame>
  );
}

async function SigninGate({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/set-password" : user.isCeo ? "/cockpit" : "/my-week");
  const sp = await searchParams;
  return <SigninForm next={typeof sp.next === "string" ? sp.next : ""} />;
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-[74px]" />
      <Skeleton className="h-[74px]" />
      <Skeleton className="h-[52px] rounded-full" />
    </div>
  );
}
