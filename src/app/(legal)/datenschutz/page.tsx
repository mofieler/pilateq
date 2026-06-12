import type { Metadata } from 'next';
import { getStudioConfig } from '@/lib/studio/server';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getStudioConfig();
  return {
    title: `Privacy Policy – ${config.branding.appName}`,
    description: `Privacy Policy for ${config.identity.slug}`,
    robots: { index: false },
  };
}

export default async function DatenschutzPage() {
  const studio = await getStudioConfig();
  const controller = studio.identity.name;
  const contactEmail = studio.identity.email;
  const platformUrl = studio.identity.website?.replace(/^https?:\/\//, '') ?? studio.identity.slug;
  return (
    <article className="max-w-none">
      <h1 className="text-3xl font-bold text-[#4e2b22] mb-2">Privacy Policy</h1>
      <p className="text-sm text-[#8b6b5c] mb-2">
        Last updated:{' '}
        {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
      </p>
      <p className="text-sm text-[#8b6b5c] mb-10">
        This Privacy Policy applies to the booking platform{' '}
        <strong className="text-[#6b3d32]">{platformUrl}</strong>.
      </p>

      <Section title="1. Controller (Art. 4 No. 7 GDPR)">
        <p>
          {controller}<br />
          {studio.identity.address}, {studio.identity.city}, {studio.identity.country}<br />
          E-mail:{' '}
          <a href={`mailto:${contactEmail}`} className="text-[#6b3d32] underline underline-offset-2">
            {contactEmail}
          </a>
        </p>
      </Section>

      <Section title="2. Data We Collect and Why">
        <SubSection title="2.1 Registration &amp; User Account">
          <p>
            When you register, we collect your <strong>email address</strong>,{' '}
            <strong>name</strong> (optional), and <strong>phone number</strong> (optional).
            This data is required to provide you with a user account for booking classes.
          </p>
          <Legal>
            Legal basis: Art. 6(1)(b) GDPR (performance of a contract) · Retention: until
            account deletion; financial data at least 10 years pursuant to § 147 AO.
          </Legal>
        </SubSection>

        <SubSection title="2.2 Bookings &amp; Payments">
          <p>
            When booking a class or purchasing a credit package, we process the following data:
            booked class, date/time, credit type, payment status, and invoice number.
            Invoices are retained for ten years pursuant to § 147 AO.
          </p>
          <Legal>
            Legal basis: Art. 6(1)(b) GDPR (performance of a contract),
            Art. 6(1)(c) GDPR (legal obligations / tax law).
          </Legal>
        </SubSection>

        <SubSection title="2.3 Email Notifications">
          <p>
            We send transactional emails (booking confirmation, cancellation, invoices) via
            the service provider <strong>Resend</strong> (Resend, Inc., USA). The transfer is
            carried out on the basis of Standard Contractual Clauses (Art. 46(2)(c) GDPR).
          </p>
          <Legal>Legal basis: Art. 6(1)(b) GDPR.</Legal>
        </SubSection>

        <SubSection title="2.4 Server Logs &amp; Security">
          <p>
            Our hosting provider <strong>Hetzner Online GmbH</strong> (Germany) processes
            technical access data (IP address, timestamp, HTTP method) to ensure operational
            security. This data is automatically deleted after 7 days.
          </p>
          <Legal>
            Legal basis: Art. 6(1)(f) GDPR (legitimate interest in IT security).
          </Legal>
        </SubSection>

        <SubSection title="2.5 Cookies">
          <p>
            This platform uses only <strong>technically necessary cookies</strong> (session
            cookie for login, CSRF protection). No tracking, analytics, or marketing cookies
            are set. Consent is therefore not required (§ 25(2)(2) TDDDG).
          </p>
        </SubSection>
      </Section>

      <Section title="3. Disclosure to Third Parties">
        <p>
          We share your data only to the extent necessary for the performance of the contract
          (e.g., Resend for email delivery) or where required by law. Your data is not sold.
        </p>
      </Section>

      <Section title="4. Your Rights (Art. 15–22 GDPR)">
        <ul className="space-y-2 list-none pl-0">
          {[
            ['Access (Art. 15)', 'You may request information about the data we hold about you at any time.'],
            ['Rectification (Art. 16)', 'You can correct inaccurate data via your profile settings or by contacting us.'],
            ['Erasure (Art. 17)', 'You may request the deletion of your account. Booking and invoice data is subject to statutory retention periods (§ 147 AO, 10 years).'],
            ['Restriction (Art. 18)', 'You may request that the processing of your data be restricted.'],
            ['Objection (Art. 21)', 'You may object to processing based on legitimate interests.'],
            ['Data portability (Art. 20)', 'You may receive your data in a structured, machine-readable format.'],
            ['Complaint (Art. 77)', 'You have the right to lodge a complaint with a supervisory authority.'],
          ].map(([right, desc]) => (
            <li key={right as string} className="flex gap-3">
              <span className="text-sm font-semibold text-[#8b6b5c] w-52 shrink-0">{right}</span>
              <span className="text-sm text-[#6b3d32]">{desc}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          Please direct requests to:{' '}
          <a href={`mailto:${contactEmail}`} className="text-[#6b3d32] underline underline-offset-2">
            {contactEmail}
          </a>
        </p>
      </Section>

      <Section title="5. Changes to This Policy">
        <p>
          We reserve the right to update this Privacy Policy when the platform or the legal
          situation changes. The current version is always available at{' '}
          <strong>{platformUrl}/datenschutz</strong>.
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
      <div className="space-y-4 text-sm text-[#4e2b22] leading-relaxed">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-sm font-semibold text-[#6b3d32] mb-2"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Legal({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-[#8b6b5c] bg-[#faf9f7] border border-[#ede8e5] rounded-lg px-3 py-2 mt-2">
      {children}
    </p>
  );
}
