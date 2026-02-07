import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Live Ireland Dashboard",
    template: "%s | Live Ireland",
  },
  description:
    "Real-time national infrastructure dashboard for Ireland spanning grid, weather, transport, and outages.",
  keywords: [
    "Ireland dashboard",
    "EirGrid",
    "Met Eireann",
    "Irish Rail",
    "ESB outages",
    "real-time data",
  ],
  openGraph: {
    title: "Live Ireland Dashboard",
    description:
      "A real-time public-data dashboard for Ireland: electricity grid, weather, transport, and outage alerts.",
    type: "website",
    locale: "en_IE",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
