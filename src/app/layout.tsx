import type { Metadata, Viewport } from "next";
import Link from "next/link";
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
        <header className="sticky top-0 z-[1000] border-b border-edge/70 bg-ink/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber text-lg text-ink">
                🛞
              </span>
              <span>
                <span className="block text-[15px] font-bold leading-none tracking-tight">
                  RoadSathi
                </span>
                <span className="block text-[10px] uppercase tracking-[0.18em] text-muted">
                  Highway rescue network
                </span>
              </span>
            </Link>

            <nav className="flex items-center gap-1.5 text-sm">
              <Link href="/mechanic" className="hidden rounded-lg px-3 py-2 text-muted transition hover:text-white sm:block">
                Mechanic
              </Link>
              <Link href="/how" className="hidden rounded-lg px-3 py-2 text-muted transition hover:text-white sm:block">
                How it works
              </Link>
              <Link href="/sos" className="btn-sos px-3.5 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                SOS
              </Link>
            </nav>
          </div>
        </header>

        {children}

        <footer className="mt-20 border-t border-edge/70 py-8 text-center text-xs text-muted">
          RoadSathi &middot; built for open innovation &middot; emergency services in India:
          <span className="text-white"> 112</span> (all) &middot;
          <span className="text-white"> 108</span> (ambulance) &middot;
          <span className="text-white"> 1033</span> (highway helpline)
        </footer>
      </body>
    </html>
  );
}
