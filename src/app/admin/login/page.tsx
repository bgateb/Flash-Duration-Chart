import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm items-center justify-center px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
