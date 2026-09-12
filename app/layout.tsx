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
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/favicon.svg',
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
    "AI receptionist for driving schools",
    "AI phone receptionist",
    "voice AI booking",
    "driving school management software",
    "AI answering service Australia",
    "driving instructor CRM",
    "automated booking system",
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
                'DriveBook is Australian driving school management software with a built-in AI phone receptionist. The AI answers calls 24/7, books lessons, sends SMS confirmations, and handles cancellations — while instructors are teaching.',
              areaServed: { '@type': 'Country', name: 'Australia' },
              // sameAs: Add your directory listing URLs here once live, e.g.:
              // sameAs: [
              //   'https://www.g2.com/products/drivebook',
              //   'https://www.capterra.com.au/software/drivebook',
              //   'https://www.producthunt.com/posts/drivebook',
              // ],
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'customer support',
                availableLanguage: 'English',
                url: `${BASE_URL}/contact`,
              },
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: 'DriveBook Platform Features',
                itemListElement: [
                  {
                    '@type': 'Offer',
                    name: 'AI Phone Receptionist',
                    description: 'AI voice agent that answers calls 24/7, checks live availability, books driving lessons, and sends SMS confirmations automatically.',
                    url: `${BASE_URL}/features/ai-receptionist`,
                  },
                  {
                    '@type': 'Offer',
                    name: 'Online Booking System',
                    description: 'Students book lessons directly from instructor profiles with real-time availability.',
                    url: `${BASE_URL}/features/online-booking`,
                  },
                ],
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
        {/* Google Ads conversion tracking */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18353082328" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'AW-18353082328');
            `,
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
