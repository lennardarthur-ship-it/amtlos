import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Amtlos Studio", template: "%s · Amtlos Studio" },
  robots: { index: false, follow: false },
};

export default function Wurzel({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
