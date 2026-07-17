import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · GymHood Storage" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Already signed in? Skip the form.
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Image
            src="/gymhood-logo.png"
            alt="GymHood logo"
            width={140}
            height={140}
            priority
            className="mx-auto mb-3"
          />
          <h1 className="font-display text-3xl font-semibold tracking-wide text-gold">
            GymHood Storage
          </h1>
          <p className="mt-2 text-sm text-cream/55">Sign in to manage stock</p>
        </div>

        <div className="rounded-2xl border border-edge bg-surface p-6 shadow-lg shadow-black/40">
          <div className="mx-auto mb-5 h-0.5 w-16 bg-gradient-to-r from-maroon via-gold/70 to-maroon" />
          <LoginForm callbackUrl={callbackUrl || "/"} />
        </div>
      </div>
    </main>
  );
}
