import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Class schedule',
  description: 'Weekly class schedule',
  robots: { index: false, follow: false },
};

/** No extra Providers — root layout already wraps the app. */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-0 bg-[#faf9f7] antialiased">{children}</div>;
}
