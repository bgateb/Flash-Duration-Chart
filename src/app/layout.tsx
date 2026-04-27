import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flash Duration Chart",
  description: "Measured t.1 flash duration across power settings for tested flash units.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("theme")?.value;
  const htmlClass = theme === "dark" ? "dark" : undefined;

  return (
    <html lang="en" className={htmlClass} suppressHydrationWarning>
      <head>
        {/* First-visit only (no cookie yet): honor system preference before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(document.cookie.indexOf('theme=')!==-1)return;if(window.matchMedia('(prefers-color-scheme:dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
