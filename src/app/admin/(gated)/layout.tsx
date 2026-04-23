import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GatedAdminLayout({ children }: { children: React.ReactNode }) {
  const ok = await requireAdmin();
  if (!ok) redirect("/admin/login");

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-4">
            <Link href="/admin" className="text-sm font-semibold">
              Flash Duration · Admin
            </Link>
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
              view public chart ↗
            </Link>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
