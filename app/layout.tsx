import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Bebas_Neue,
  Geist_Mono,
  Oswald,
  Outfit,
  Plus_Jakarta_Sans,
  Roboto,
} from "next/font/google";
import "./globals.css";
import { AppBrandBar } from "@/components/app-brand-bar";
import { AppFooter } from "@/components/app-footer";
import { Providers } from "@/components/providers";
import { APP_NAME } from "@/lib/app-config";

const appSans = Plus_Jakarta_Sans({
  variable: "--font-app-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Open-play queue and court flow manager.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="neon"
      suppressHydrationWarning
      className={`${appSans.variable} ${geistMono.variable} ${roboto.variable} ${outfit.variable} ${bebasNeue.variable} ${oswald.variable} h-full`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-background font-sans text-foreground antialiased"
      >
        <Providers>
          <Suspense fallback={null}>
            <AppBrandBar />
          </Suspense>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          <AppFooter />
        </Providers>
      </body>
    </html>
  );
}
