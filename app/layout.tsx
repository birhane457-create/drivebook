import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

const BASE_URL = process.env.NEXTAUTH_URL || "https://drivebook.com.au";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "DriveBook – Book Driving Lessons in Australia",
    template: "%s | DriveBook",
  },
  description:
    "Find approved local driving instructors near you. Book online or by phone 24/7. Flexible lesson packages, transparent pricing, instant SMS confirmation. Manual & Automatic available.",
  keywords: [
    "driving lessons",
    "driving instructor",
    "book driving lessons",
    "learner driver",
    "driving school",
    "driving instructor near me",
    "manual driving lessons",
    "automatic driving lessons",
    "test preparation",
    "PDA test",
    "Australia driving school",
  ],
  authors: [{ name: "DriveBook", url: BASE_URL }],
  creator: "DriveBook",
  publisher: "DriveBook",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: BASE_URL,
    siteName: "DriveBook",
    title: "DriveBook – Book Driving Lessons in Australia",
    description:
      "Find approved local driving instructors near you. Book online or by phone 24/7. Flexible packages, transparent pricing.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DriveBook – Book Driving Lessons Online",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DriveBook – Book Driving Lessons in Australia",
    description:
      "Find approved local driving instructors. Book online or by phone 24/7.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: BASE_URL,
  },
  category: "education",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* RSS feed auto-discovery */}
        <link rel="alternate" type="application/rss+xml" title="DriveBook Blog" href={`${BASE_URL}/rss.xml`} />
        {/* Organization structured data — enables Google Knowledge Panel */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'DriveBook',
              url: BASE_URL,
              logo: `${BASE_URL}/logo.png`,
              description:
                'DriveBook connects learners with approved driving instructors across Australia. Book online or by phone 24/7.',
              areaServed: { '@type': 'Country', name: 'Australia' },
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'customer support',
                availableLanguage: 'English',
                url: `${BASE_URL}/contact`,
              },
            }),
          }}
        />
        {/* WebSite schema — enables Google Sitelinks Searchbox */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'DriveBook',
              url: BASE_URL,
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${BASE_URL}/book?location={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} ${plusJakartaSans.variable} ${inter.className}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
