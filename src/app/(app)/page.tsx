import { requireUser } from "@/lib/rbac";

// Placeholder home. Replaced by the product grid + stock accordion in a later
// phase.
export default async function HomePage() {
  const user = await requireUser();
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-bold">Stock</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Signed in as{" "}
        <span className="font-medium">{user.name || user.username}</span> (
        {user.role}). Product grid coming next.
      </p>
    </div>
  );
}
