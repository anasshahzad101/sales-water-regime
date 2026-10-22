"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/ui/error-page";
import { fmtDateTime } from "@/lib/time";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const ref = `ERR-${(error.digest ?? "LOCAL").slice(0, 10).toUpperCase()} · ${fmtDateTime(new Date())}`;
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <ErrorScreen
        code="500"
        title="Something went wrong on our side"
        text="Everything you saved before this is safe. Try again in a moment. If it keeps happening, send the reference below to your admin."
        reference={ref}
        primary={{ label: "Try again", icon: "refresh-cw", onClick: reset }}
        secondary={{ label: "Go to my home page", icon: "arrow-left", href: "/" }}
      />
    </div>
  );
}
