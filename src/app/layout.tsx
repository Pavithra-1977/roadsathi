import type { Metadata, Viewport } from "next";
import AppShell from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoadSathi - highway breakdown help in minutes",
  description:
    "Connects stranded highway travellers with idle local mechanics in 5-10 minutes. AI fault triage, parts routing, and a Plan B that gets your family home safely even when the vehicle cannot be fixed.",
};

export const viewport: Viewport = {
  themeColor: "#070B14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
