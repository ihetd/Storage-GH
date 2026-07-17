import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Card, PageHeader } from "@/components/ui";
import type { Role } from "@/lib/roles";
import { EmployeeCreateForm, EmployeeRow } from "./employee-forms";

export const metadata = { title: "Employees · Dashboard" };

export default async function EmployeesPage() {
  const me = await requireRole(["ADMIN"]);
  const employees = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Named accounts and their roles. ADMIN manages everything; EDITOR can adjust stock; VIEWER is read-only."
      />

      <Card className="mb-6">
        <EmployeeCreateForm />
      </Card>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-cream/45">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <EmployeeRow
                key={e.id}
                isSelf={e.id === me.id}
                employee={{
                  id: e.id,
                  username: e.username,
                  name: e.name,
                  role: e.role as Role,
                  active: e.active,
                }}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
