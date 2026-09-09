import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/ui";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import products · Dashboard" };

export default async function ImportPage() {
  await requireRole(["ADMIN"]);

  return (
    <div>
      <PageHeader
        title="Import from a spreadsheet"
        description="Add or update many products at once instead of one at a time."
      />
      <ImportForm />
    </div>
  );
}
