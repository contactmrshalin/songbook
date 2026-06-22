import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import AdSenseLoader from "@/components/AdSenseLoader";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "Songbook | Sargam Notations for Bollywood & Indian Songs",
    template: "%s | Songbook",
  },
  description:
    "Free sargam notations for 190+ Bollywood and Indian classical songs. Play along on flute, harmonium, piano, or any instrument with our interactive notation viewer.",
  keywords: [
    "sargam notation",
    "bollywood songs notation",
    "flute notes",
    "harmonium notes",
    "indian music notation",
    "sa re ga ma",
    "hindi songs sargam",
    "piano notes bollywood",
  ],
  metadataBase: new URL("https://songnotations.vercel.app"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Songbook | Sargam Notations for Bollywood & Indian Songs",
    description:
      "Free sargam notations for 190+ Bollywood and Indian classical songs. Play along on flute, harmonium, piano, or any instrument.",
    url: "https://songnotations.vercel.app",
    siteName: "Songbook",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Songbook | Sargam Notations for Bollywood & Indian Songs",
    description:
      "Free sargam notations for 190+ Bollywood and Indian classical songs.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <head />
      <body className="min-h-full flex flex-col antialiased paper-bg">
        <AdSenseLoader />
        {children}
      </body>
    </html>
  );
}
