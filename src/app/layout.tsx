// src/app/layout.tsx
import { CartProvider } from "@/src/app/components/cart-provider";
import { CategoryProvider } from "@/src/app/components/category-provider";
import { QueryProvider } from "@/src/app/components/query-provider";
import { ThemeProvider } from "@/src/app/components/theme-provider";
import { Toaster } from "@/src/app/components/ui/toaster";
import { AuthProvider } from "@/src/app/context/auth-context";
import { LayoutWrapper } from "@/src/app/components/layout-wrapper";
import "@/src/app/index.css";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type React from "react";
import { getCurrentYear } from "@/src/app/lib/current-year";
import Footer from "@/src/app/components/footer";
import { JsonLd } from "@/src/app/components/json-ld";
import {
  ALL_KEYWORDS,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  organizationJsonLd,
  SITE_NAME,
  SITE_URL,
  websiteJsonLd,
} from "@/src/app/lib/seo";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

const inter = Inter({ subsets: ["latin"] });

/*
 * The defaults every page inherits. A page's own title and
 * description replace these; metadataBase is what turns the
 * relative canonical and image paths pages use into absolute
 * URLs. No canonical here: it would be inherited by every page
 * that does not set its own, marking each as a copy of the
 * homepage. Icons are picked up from the
 * files beside this layout (icon.png, apple-icon.png);
 * the share card is public/haani-fabrics-hero.png.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  keywords: ALL_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "shopping",
  openGraph: {
    type: "website",
    locale: "en_PK",
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#fbf8f2",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const year = await getCurrentYear();

  return (
    <html lang="en-PK">
      <body className={inter.className}>
        {/* Who the shop is, for search engines: name, logo, address, contact. */}
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />

        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          disableTransitionOnChange
        >
          {/* Outermost of the data providers: the others read through it. */}
          <QueryProvider>
            <AuthProvider>
              <CartProvider>
                {/*
                 * Above LayoutWrapper so the admin, which renders
                 * without the header, reads the same store the
                 * storefront does.
                 */}
                <CategoryProvider>
                  <div className="flex min-h-screen flex-col">
                    <LayoutWrapper footer={<Footer year={year} />}>{children}</LayoutWrapper>
                  </div>
                </CategoryProvider>
                <Toaster />
              </CartProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>

        {/*
         * Vercel Web Analytics: page views and visitors, no
         * cookies. Outside the providers because it renders
         * nothing and only reports the route it is on.
         */}
        <Analytics />
      </body>
    </html>
  );
}
