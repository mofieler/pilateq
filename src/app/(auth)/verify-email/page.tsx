import { MailCheck } from 'lucide-react';

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  // Keep prop shape for route signature compatibility; params intentionally not used here.
  void searchParams;

  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center size-20 rounded-full bg-[#4e2b22]/10 mb-6">
        <MailCheck className="size-10 text-[#4e2b22]" />
      </div>

      <h1 className="text-2xl font-bold text-[#4e2b22] mb-3">Check your inbox</h1>
      <p className="text-[#6b3d32] mb-6 leading-relaxed">
        We&apos;ve sent a verification link to your email address. Click the link to activate
        your account — it expires in 24 hours.
      </p>

      <div className="rounded-2xl border border-[#ede8e5]/80 bg-gradient-to-br from-[#faf9f7]/80 to-[#ede8e5]/40 p-5 text-left mb-6">
        <p className="text-sm text-[#6b3d32] font-medium mb-1">Didn&apos;t receive it?</p>
        <ul className="text-sm text-[#8b6b5c] space-y-1 list-disc list-inside">
          <li>Check your spam or junk folder</li>
          <li>Make sure you entered the correct email</li>
          <li>Wait a few minutes and refresh your inbox</li>
        </ul>
      </div>

      <a
        href="/login"
        className="text-sm text-[#4e2b22] font-semibold hover:text-[#6b3d32] transition-colors"
      >
        ← Back to sign in
      </a>
    </div>
  );
}
