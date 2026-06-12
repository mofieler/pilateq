import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { getStudioConfig } from "@/lib/studio/server";
import { StudioConfigProvider } from "@/lib/studio";
import { I18nProvider } from "@/lib/i18n";
import { loadMessages, resolveServerLocale } from "@/lib/i18n";    

export const viewport: Viewport = {
  themeColor: '#faf9f7',
};

export const dynamic = 'force-dynamic';

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const config = await getStudioConfig();
  return {
    title: `${config.branding.appName} - Booking System for Boutique Pilates Studios`,
    description: "Book your perfect Pilates class experience",
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      ],
      apple: [
        { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
      other: [
        { rel: 'mask-icon', url: '/favicon.svg', color: config.branding.primaryColor },
      ],
    },
    manifest: '/site.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: config.branding.appName,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = await getStudioConfig();
  const locale = await resolveServerLocale();
  const messages = loadMessages(locale);

  return (
    <html
      lang={locale}
      className={`${outfit.variable} h-full antialiased [scrollbar-gutter:stable]`}
    >
      <body className="min-h-full flex flex-col font-outfit">
        <StudioConfigProvider config={config}>
          <I18nProvider locale={locale} messages={messages}>
            <Providers>
              {children}
            </Providers>
          </I18nProvider>
        </StudioConfigProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
