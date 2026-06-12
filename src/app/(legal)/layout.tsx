import Link from 'next/link';
import { getStudioConfig } from '@/lib/studio/server';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const studio = await getStudioConfig();
  const appName = studio.branding.appName || APP_CONFIG.APP_NAME;
  const studioName = studio.identity.legalName || studio.identity.name || 'Your Studio';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf9f7] to-[#f5f3f1]">
      <nav className="border-b border-[#ede8e5]/80 bg-[#faf9f7]/90 backdrop-blur-xl px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-bold text-[#4e2b22] hover:text-[#6b3d32] transition-colors"
          >
            <img src="/logo.png" alt={appName} className="h-7 w-auto" />
            {appName}
          </Link>
          <span className="text-[#c4a88a]">/</span>
          <span className="text-sm text-[#8b6b5c]">Legal</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">{children}</main>

      <footer className="border-t border-[#ede8e5] bg-[#faf9f7] px-6 py-6 mt-12">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-4 justify-between items-center">
          <p className="text-xs text-[#a6856f]">
            &copy; {new Date().getFullYear()} {studioName}
          </p>
          <div className="flex gap-4 text-xs flex-wrap">
            <Link href="/impressum"      className="text-[#8b6b5c] hover:text-[#4e2b22] transition-colors">Impressum</Link>
            <Link href="/datenschutz"    className="text-[#8b6b5c] hover:text-[#4e2b22] transition-colors">Privacy Policy</Link>
            <Link href="/agb"            className="text-[#8b6b5c] hover:text-[#4e2b22] transition-colors">T&amp;Cs</Link>
            <Link href="/widerrufsrecht" className="text-[#8b6b5c] hover:text-[#4e2b22] transition-colors">Cancellation Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
