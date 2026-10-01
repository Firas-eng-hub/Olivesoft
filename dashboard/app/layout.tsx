import type { Metadata } from "next";
import ReactDOM from "react-dom";
import "./globals.css";

export const metadata: Metadata = {
  title: "OliveSoft — Intelligence Workspace",
  description: "An interactive command center for opportunity intelligence and proposal delivery.",
  icons: { icon: [{ url: "/olivesoft-symbol.svg", type: "image/svg+xml" }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  ReactDOM.preconnect("https://fonts.googleapis.com");
  ReactDOM.preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" });
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
