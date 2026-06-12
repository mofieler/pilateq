import type { Metadata } from 'next';
import { getStudioConfig } from '@/lib/studio/server';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getStudioConfig();
  return {
    title: `Impressum – ${config.branding.appName}`,
    description: `Legal notice for ${config.identity.slug}`,
    robots: { index: false },
  };
}

export default async function ImpressumPage() {
  const studio = await getStudioConfig();
  const bookingDomain = studio.identity.website?.replace(/^https?:\/\//, '') ?? studio.identity.slug;

  const identityIncomplete = !studio.identity.name || !studio.identity.address || !studio.identity.city || !studio.identity.email;

  return (
    <article className="prose-sm max-w-none">
      <h1 className="text-3xl font-bold text-[#4e2b22] mb-2">Impressum</h1>
      <p className="text-sm text-[#8b6b5c] mb-10">Legal notice · Angaben gemäß § 5 TMG</p>

      {identityIncomplete && (
        <div className="mb-10 rounded-xl border border-[#c4a88a]/50 bg-[#fff8ee] p-5 text-sm text-[#4e2b22]">
          Studio identity not fully configured. Please complete settings in the admin panel.
        </div>
      )}

      <Section title="Anbieter dieser Plattform">
        <Field label="Unternehmensform">Gesellschaft bürgerlichen Rechts (GbR)</Field>
        <Field label="Name">{studio.identity.name}</Field>
        <Field label="Adresse">
          {studio.identity.address}<br />
          {studio.identity.city}<br />
          {studio.identity.country}
        </Field>
        {studio.identity.phone && (
          <Field label="Telefon">
            <a href={`tel:${studio.identity.phone.replace(/\s/g, '')}`} className="text-[#6b3d32] underline underline-offset-2">
              {studio.identity.phone}
            </a>
          </Field>
        )}
        <Field label="E-Mail">
          <a href={`mailto:${studio.identity.email}`} className="text-[#6b3d32] underline underline-offset-2">
            {studio.identity.email}
          </a>
        </Field>
        <Field label="Website (Studio)">
          <a href={studio.identity.website} target="_blank" rel="noopener noreferrer" className="text-[#6b3d32] underline underline-offset-2">
            {studio.identity.website?.replace(/^https?:\/\//, '')}
          </a>
        </Field>
        <Field label="Booking-Plattform">
          <a href={studio.identity.website} className="text-[#6b3d32] underline underline-offset-2">
            {bookingDomain}
          </a>
        </Field>
      </Section>

      <Section title="Steuerliche Angaben">
        <Field label="Steuernummer">{studio.identity.taxNumber}</Field>
        <Field label="Zuständiges Finanzamt">{studio.identity.taxAuthority}</Field>
        <p className="text-sm text-[#8b6b5c] mt-2">
          Die GbR übt ausschließlich freiberufliche Tätigkeiten im Sinne des § 18 EStG aus
          (Unterricht / Bewegungspädagogik). Es wird keine Gewerbesteuer erhoben.
          Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen (Kleinunternehmerregelung).
        </p>
      </Section>

      <Section title="Verantwortliche Personen (§ 55 Abs. 2 RStV)">
        <p className="text-sm text-[#6b3d32]">
          {studio.identity.name}<br />
          {studio.identity.address}, {studio.identity.city}
        </p>
      </Section>

      <Section title="Haftungshinweis">
        <p className="text-sm text-[#6b3d32] leading-relaxed">
          Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte
          externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber
          verantwortlich.
        </p>
      </Section>

      <Section title="Hinweis zu Online-Streitbeilegung (OS)">
        <p className="text-sm text-[#6b3d32] leading-relaxed">
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#6b3d32] underline underline-offset-2"
          >
            https://ec.europa.eu/consumers/odr
          </a>
          . Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor
          einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-[#4e2b22] mb-4 pb-2 border-b border-[#ede8e5]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="text-sm font-semibold text-[#8b6b5c] w-44 shrink-0">{label}</span>
      <span className="text-sm text-[#4e2b22] leading-relaxed">{children}</span>
    </div>
  );
}
