import { requireUser } from "@/lib/rbac";
import { Nav } from "@/components/nav";

// Every page in this group requires an authenticated user. Middleware already
// redirects anonymous requests, but we re-check here (authoritative) and to get
// the user for the nav.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <Nav user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
