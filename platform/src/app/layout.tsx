import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased paper-bg">
        {children}
      </body>
    </html>
  );
}
