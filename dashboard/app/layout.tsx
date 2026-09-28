import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OliveSoft — Intelligence Workspace",
  description: "An interactive command center for tender intelligence and proposal delivery.",
  icons: { icon: [{ url: "/olivesoft-symbol.svg", type: "image/svg+xml" }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
