import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { isPortfolioDemoEnabled } from "@/lib/portfolio-demo";
import "./globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-rehearse-sans",
  display: "swap",
});

const displayFont = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
  variable: "--font-rehearse-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Rehearse — Build skills you can prove",
    template: "%s | Rehearse",
  },
  description:
    "Turn your sources into recall practice and grow an evidence-backed Skill Tree.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5faf6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = isPortfolioDemoEnabled() ? (
    children
  ) : (
    <AuthSessionProvider>{children}</AuthSessionProvider>
  );

  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body className="antialiased">{content}</body>
    </html>
  );
}
