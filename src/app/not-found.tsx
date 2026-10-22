import type { Metadata } from "next";
import { ErrorScreen } from "@/components/ui/error-page";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <ErrorScreen
        code="404"
        title="We can’t find that page"
        text="The link may be out of date, or the record may have been deleted. Deleted records can be traced in the audit log."
        primary={{ label: "Go to my home page", icon: "arrow-left", href: "/" }}
        secondary={{ label: "Search accounts", icon: "search", href: "/accounts" }}
      />
    </div>
  );
}
