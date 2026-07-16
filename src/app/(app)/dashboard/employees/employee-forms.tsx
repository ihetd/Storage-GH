"use client";

import { useRef, useState } from "react";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "@/lib/actions/employees";
import { useFormAction } from "@/lib/use-form-action";
import { ROLES, type Role } from "@/lib/roles";
import { DeleteButton } from "@/components/delete-button";
import { RoleBadge } from "@/components/role-badge";
import { btnPrimary, btnSecondary, inputClass, labelClass } from "@/components/ui";

type Employee = {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
};

function RoleSelect({ defaultValue }: { defaultValue?: Role }) {
  return (
    <select name="role" defaultValue={defaultValue ?? "VIEWER"} className={inputClass}>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

export function EmployeeCreateForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { run, pending, error } = useFormAction(createEmployee, () =>
    formRef.current?.reset(),
  );

  return (
    <form ref={formRef} action={run}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Username</label>
          <input name="username" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Full name</label>
          <input name="name" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Role</label>
          <RoleSelect />
        </div>
        <div>
          <label className={labelClass}>Password</label>
          <input name="password" type="password" required className={inputClass} />
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" name="active" defaultChecked className="h-4 w-4" />
        Active (can sign in)
      </label>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className={btnPrimary}>
          Add employee
        </button>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
    </form>
  );
}

export function EmployeeRow({
  employee,
  isSelf,
}: {
  employee: Employee;
  isSelf: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const { run, pending, error } = useFormAction(updateEmployee, () =>
    setEditing(false),
  );

  if (editing) {
    return (
      <tr className="border-t border-slate-100 dark:border-slate-800">
        <td colSpan={4} className="px-3 py-3">
          <form action={run}>
            <input type="hidden" name="id" value={employee.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Username</label>
                <input name="username" required defaultValue={employee.username} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Full name</label>
                <input name="name" required defaultValue={employee.name} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <RoleSelect defaultValue={employee.role} />
              </div>
              <div>
                <label className={labelClass}>
                  New password{" "}
                  <span className="font-normal text-slate-400">
                    (blank = unchanged)
                  </span>
                </label>
                <input name="password" type="password" className={inputClass} />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                name="active"
                defaultChecked={employee.active}
                className="h-4 w-4"
              />
              Active (can sign in)
            </label>
            <div className="mt-4 flex items-center gap-3">
              <button type="submit" disabled={pending} className={btnPrimary}>
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className={btnSecondary}>
                Cancel
              </button>
              {error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              ) : null}
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <td className="px-3 py-2.5">
        <div className="font-medium">{employee.name}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          @{employee.username}
          {isSelf ? " · you" : ""}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <RoleBadge role={employee.role} />
      </td>
      <td className="px-3 py-2.5">
        {employee.active ? (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Active
          </span>
        ) : (
          <span className="text-xs font-medium text-slate-400">Inactive</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="inline-flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Edit
          </button>
          {isSelf ? null : (
            <DeleteButton
              action={deleteEmployee.bind(null, employee.id)}
              confirmLabel="Delete employee?"
            />
          )}
        </span>
      </td>
    </tr>
  );
}
