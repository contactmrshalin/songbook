import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import AdSenseLoader from "@/components/AdSenseLoader";
import { ADSENSE_PUBLISHER_ID } from "@/lib/ads.config";
import { SITE_CONFIG } from "@/lib/site.config";
import "./globals.css";

const ENABLE_PROPELLER_GLOBAL_TAG =
  process.env.NEXT_PUBLIC_ENABLE_PROPELLER_GLOBAL_TAG === "true";

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
  metadataBase: new URL(SITE_CONFIG.url),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Songbook | Sargam Notations for Bollywood & Indian Songs",
    description:
      "Free sargam notations for 190+ Bollywood and Indian classical songs. Play along on flute, harmonium, piano, or any instrument.",
    url: SITE_CONFIG.url,
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
  verification: {
    google: "v2LGt0oEFLfhuLBQjA_SFJugB1Mqd3uooygWMRwxK80",
  },
  other: {

    "google-adsense-account": ADSENSE_PUBLISHER_ID,
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
      <head>

        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(s){s.dataset.zone='11193230',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))",
          }}
        />

        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(s){s.dataset.zone='11193233',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))",
          }}
        />

        {ENABLE_PROPELLER_GLOBAL_TAG ? (
          <script
            src="https://quge5.com/88/tag.min.js"
            data-zone="252932"
            async
            data-cfasync="false"
          ></script>
        ) : null}
      </head>
      <body className="min-h-full flex flex-col antialiased paper-bg">
        <AdSenseLoader />
        {children}
      </body>
    </html>
  );
}
