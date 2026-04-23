"use client";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth", { method: "DELETE" });
        window.location.href = "/admin/login";
      }}
      className="text-xs text-muted-foreground hover:text-foreground"
    >
      log out
    </button>
  );
}
