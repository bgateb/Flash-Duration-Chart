import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flash Duration Chart",
  description: "Measured t.1 flash duration across power settings for tested flash units.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
