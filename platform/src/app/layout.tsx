import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { ADSENSE_PUBLISHER_ID, isAdSenseConfigured } from "@/lib/ads.config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Songbook | Musical Notation Platform",
  description:
    "Interactive musical notation platform for Indian classical and Bollywood songs. Browse, play, and edit sargam notations for flute, harmonium, and more.",
  keywords: [
    "sargam",
    "notation",
    "flute",
    "bollywood",
    "indian music",
    "harmonium",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsConfigured = isAdSenseConfigured();

  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <head>
        {adsConfigured && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="min-h-full flex flex-col antialiased paper-bg">
        {children}
      </body>
    </html>
  );
}
