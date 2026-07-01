import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { WindowCloseLogout } from "@/components/window-close-logout";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mi Diario",
  description: "Diario personal privado",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edebe6" },
    { media: "(prefers-color-scheme: dark)", color: "#2E2824" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geist.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased pb-[env(safe-area-inset-bottom)]">
        <ThemeProvider>
          <WindowCloseLogout />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
