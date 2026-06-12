import type { Metadata } from 'next';
import { getStudioConfig } from '@/lib/studio/server';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getStudioConfig();
  return {
    title: `Widerrufsbelehrung – ${config.branding.appName}`,
    description: `Widerrufsrecht und Widerrufsbelehrung für ${config.identity.slug}`,
    robots: { index: false },
  };
}

export default async function WiderrufsrechtPage() {
  const studio = await getStudioConfig();
  return (
    <article className="prose-sm max-w-none">
      <h1 className="text-3xl font-bold text-[#4e2b22] mb-2">Widerrufsbelehrung</h1>
      <p className="text-sm text-[#8b6b5c] mb-10">
        Information über das gesetzliche Widerrufsrecht für Verbraucher
      </p>

      <Section title="Widerrufsrecht">
        <p>
          Sie haben das Recht, binnen <strong>14 Tagen</strong> ohne Angabe von Gründen diesen
          Vertrag zu widerrufen. Die Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsabschlusses.
        </p>
        <p>
          Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
        </p>
        <p className="pl-4 border-l-2 border-[#c4a88a] italic">
          {studio.identity.name}<br />
          {studio.identity.address}<br />
          {studio.identity.city}<br />
          E-Mail: <a href={`mailto:${studio.identity.email}`} className="underline underline-offset-2">{studio.identity.email}</a>
        </p>
        <p>
          mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine
          E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Zur Wahrung der
          Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts
          vor Ablauf der Widerrufsfrist absenden.
        </p>
      </Section>

      <Section title="Folgen des Widerrufs">
        <p>
          Wenn Sie diesen Vertrag widerrufen, erstatten wir Ihnen alle Zahlungen, die wir von Ihnen
          erhalten haben, unverzüglich und spätestens binnen 14 Tagen ab dem Tag zurück, an dem die
          Mitteilung über Ihren Widerruf bei uns eingegangen ist. Für diese Rückzahlung verwenden
          wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben,
          es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart.
        </p>
      </Section>

      <Section title="Vorzeitiges Erlöschen des Widerrufsrechts">
        <p className="rounded-lg bg-[#fdf8f5] border border-[#c4a88a] p-4">
          <strong>Wichtig:</strong> Bei einem Vertrag über die Bereitstellung von <em>digitalen
          Inhalten und Dienstleistungen</em> (z. B. Credit-Guthaben, das sofort für Kursbuchungen
          genutzt werden kann) <strong>erlischt das Widerrufsrecht</strong>, wenn
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-[#4e2b22]">
          <li>
            Sie ausdrücklich zugestimmt haben, dass mit der Ausführung des Vertrags vor Ablauf der
            Widerrufsfrist begonnen wird, <em>und</em>
          </li>
          <li>
            Sie Ihre Kenntnis davon bestätigt haben, dass Sie durch diese Zustimmung mit Beginn der
            Ausführung des Vertrags Ihr Widerrufsrecht verlieren (§ 356 Abs. 5 BGB).
          </li>
        </ol>
        <p>
          Bei der Buchung eines Credit-Pakets über unsere Plattform geben Sie diese Zustimmung
          explizit per Häkchen vor der Bestellung ab. Die Credits werden Ihrem Konto unmittelbar
          gutgeschrieben, damit Sie sofort Kurse buchen können.
        </p>
      </Section>

      <Section title="Hinweis zu bereits gebuchten Kursen">
        <p>
          Unabhängig vom Widerrufsrecht gelten für die <strong>Stornierung einzelner Kurse</strong>
          die in unseren AGB beschriebenen Regelungen (24-Stunden-Frist, einmalige Kulanz-Storno).
          Diese Stornierungsregelung ist eine zusätzliche Kulanzleistung des Studios und ersetzt
          nicht das gesetzliche Widerrufsrecht.
        </p>
      </Section>

      <Section title="Muster-Widerrufsformular">
        <p>
          Wenn Sie den Vertrag widerrufen wollen, können Sie das folgende Formular kopieren,
          ausfüllen und an die obenstehende Adresse zurücksenden:
        </p>
        <div className="rounded-lg bg-[#f5f3f1] border border-[#ede8e5] p-4 text-xs text-[#4e2b22] leading-relaxed">
          <p>
            An die {studio.identity.name}, {studio.identity.address}, {studio.identity.city}:
          </p>
          <p className="mt-3">
            Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den
            Kauf der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*):
          </p>
          <p className="mt-3">— Bestellt am (*) / erhalten am (*):</p>
          <p>— Name des/der Verbraucher(s):</p>
          <p>— Anschrift des/der Verbraucher(s):</p>
          <p>— Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):</p>
          <p>— Datum:</p>
          <p className="mt-3 text-[#8b6b5c]">(*) Unzutreffendes streichen.</p>
        </div>
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
