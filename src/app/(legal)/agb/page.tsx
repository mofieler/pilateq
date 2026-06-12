import type { Metadata } from 'next';
import { getStudioConfig } from '@/lib/studio/server';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getStudioConfig();
  return {
    title: `Terms & Conditions – ${config.branding.appName}`,
    description: `General Terms and Conditions for ${config.identity.slug}`,
    robots: { index: false },
  };
}

export default async function AGBPage() {
  const studio = await getStudioConfig();
  const appName = studio.branding.appName;
  const studioName = studio.identity.legalName || studio.identity.name;
  const bookingDomain = studio.identity.website
    ? new URL(studio.identity.website).hostname
    : APP_CONFIG.APP_URL.replace(/^https?:\/\//, '');

  if (!studio.identity.name || !studio.identity.address || !studio.identity.city || !studio.identity.email) {
    return (
      <article className="prose-sm max-w-none">
        <h1 className="text-3xl font-bold text-[#4e2b22] mb-2">General Terms and Conditions (T&amp;Cs)</h1>
        <p className="text-sm text-[#8b6b5c]">
          Studio identity not fully configured. Please complete settings in the admin panel.
        </p>
      </article>
    );
  }

  return (
    <article className="prose-sm max-w-none">
      <h1 className="text-3xl font-bold text-[#4e2b22] mb-2">General Terms and Conditions (T&amp;Cs)</h1>
      <p className="text-sm text-[#8b6b5c] mb-10">
        {studioName} · Last updated:{' '}
        {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
      </p>

      <Section title="1. Scope of Application">
        <p>
          These General Terms and Conditions apply to all contracts concluded via the booking
          platform <strong>{bookingDomain}</strong> between{' '}
          <strong>{studioName}</strong> (hereinafter &quot;the Studio&quot;) and
          the user (hereinafter &quot;the Customer&quot;).
        </p>
        <p>
          By registering and using the platform, the Customer expressly accepts these T&amp;Cs.
        </p>
      </Section>

      <Section title="2. Studio Services">
        <p>
          The Studio offers Pilates group classes, private sessions, and complementary wellness
          services. Booking is made exclusively through the platform and requires a sufficient
          credit balance.
        </p>
        <p>
          Class content and availability may change. The Studio reserves the right to reschedule
          or cancel classes for operational reasons. In such cases, any credits used for the
          booking will be fully refunded.
        </p>
      </Section>

      <Section title="3. Contract Formation and Credit Packages">
        <p>
          By clicking the button <em>&quot;Buy now – binding order&quot;</em>, the Customer
          submits a binding offer to purchase the selected credit package. The contract is formed
          upon receipt of the Studio&apos;s confirmation email, which also includes the invoice
          as a PDF attachment.
        </p>
        <p>
          Credits are <strong>non-transferable</strong> and valid exclusively for classes offered
          by {studioName}.
        </p>
      </Section>

      <Section title="4. Validity Period">
        <p>
          We offer various credit packages with different expiration periods. The specific
          validity period depends on the size and terms of the selected package as displayed
          during the checkout process. Unused credits expire automatically after the specified
          period, as studio capacities and training slots are reserved for the user during this
          time.
        </p>
        <p>
          If you are unable to use your credits due to verified medical reasons, the expiration
          date can be extended upon presentation of a valid medical certificate before the
          credits expire.
        </p>
      </Section>

      <Section title="5. Prices and Payment">
        <p>
          The prices shown on the booking page at the time of ordering apply. All prices are
          final prices; no VAT is charged pursuant to § 19 UStG (small business regulation —
          Kleinunternehmerregelung).
        </p>
        <p>
          When paying <strong>at the studio</strong>, the invoice amount must be settled in
          person within <strong>14 days</strong> of the invoice date. Credits are credited to
          the account immediately after ordering so that the Customer can book classes right
          away.
        </p>
        <p>
          In the event of late payment, the Studio reserves the right to suspend further
          bookings or purchases until the outstanding invoice has been settled.
        </p>
      </Section>

      <Section title="6. Late Cancellation Policy">
        <p>
          Booked classes can be cancelled free of charge up to <strong>24 hours</strong> before
          the class starts; the credits will be fully refunded.
        </p>
        <p>
          If a cancellation occurs less than 24 hours before the class, or in the case of a
          no-show, the credit used for the booking will be charged and cannot be refunded or
          reused. A one-time goodwill cancellation (&quot;First-Time Mercy&quot;) is
          automatically applied on the first late cancellation.
        </p>
      </Section>

      <Section title="7. Customer Obligations">
        <p>
          The Customer agrees to provide accurate information during registration and to protect
          their account from unauthorised access. Participation in classes is at the
          Customer&apos;s own risk; the digital liability waiver must be signed before the first
          booking.
        </p>
      </Section>

      <Section title="8. Liability Waiver">
        <p>
          By accepting these T&amp;Cs, you agree that participation in Pilates classes is at
          your own risk. The Studio is liable without limitation for damages resulting from
          injury to life, body, or health caused by a negligent or intentional breach of duty
          by the Studio.
        </p>
        <p>
          For other damages (e.g., property damage, lost items), the Studio&apos;s liability is
          limited to cases of gross negligence (<em>grobe Fahrlässigkeit</em>) or intent
          (<em>Vorsatz</em>). The Studio is not liable for simple negligence
          (<em>leichte Fahrlässigkeit</em>).
        </p>
      </Section>

      <Section title="9. Right of Withdrawal">
        <p>
          Consumers have a statutory right of withdrawal. Details about the right of withdrawal
          and its expiry upon the immediate provision of digital services are set out in our{' '}
          <a href="/widerrufsrecht" className="text-[#6b3d32] underline underline-offset-2">
            Cancellation Policy
          </a>.
        </p>
      </Section>

      <Section title="10. Privacy">
        <p>
          The collection and processing of personal data is governed by the provisions of the
          General Data Protection Regulation (GDPR). Details are set out in our{' '}
          <a href="/datenschutz" className="text-[#6b3d32] underline underline-offset-2">
            Privacy Policy
          </a>.
        </p>
      </Section>

      <Section title="11. Final Provisions">
        <p>
          The law of the Federal Republic of Germany applies. Should individual provisions of
          these T&amp;Cs be invalid, the validity of the remaining provisions shall not be
          affected.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-[#4e2b22] mb-4 pb-2 border-b border-[#ede8e5]">
        {title}
      </h2>
      <div className="space-y-3 text-sm text-[#4e2b22] leading-relaxed">{children}</div>
    </section>
  );
}
