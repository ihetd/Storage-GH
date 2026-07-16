import { requireRole } from "@/lib/rbac";
import { DashboardTabs } from "./dashboard-tabs";

// Authoritative ADMIN gate for the whole dashboard (proxy also blocks
// non-admins earlier, but this is the real check).
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["ADMIN"]);

  return (
    <div>
      <DashboardTabs />
      {children}
    </div>
  );
}
