'use client';

import { createContext, useContext } from 'react';

export type EmbedTranslationContextType = {
  locale: string;
  hideSpots: boolean;
  t: (key: string, variables?: Record<string, string>) => string;
};

export const EmbedTranslationContext = createContext<EmbedTranslationContextType | null>(null);

export function useEmbedTranslation() {
  return useContext(EmbedTranslationContext);
}

export const EMBED_TRANSLATIONS = {
  en: {
    weeklySchedule: 'Weekly schedule',
    tapToBook: 'Tap a class to sign in and book on {url}. Availability updates every few minutes.',
    bookNow: 'Book now',
    poweredBy: 'Powered by',
    booking: 'booking',
    cancelled: 'Cancelled',
    booked: '✓ Booked',
    full: 'Full · waitlist',
    spotsFree: '{spots} / {max} spots free',
    credits: 'Credits',
    sessionCredits: 'Session Credits',
    instructorUnavailable: 'Instructor unavailable',
    legend: 'Legend',
    today: 'Today',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    dayView: 'Day',
    weekView: 'Week',
    noClassesToday: 'No classes scheduled for this day',
    comingSoonTitle: 'Coming Soon',
    comingSoonSubtitle: 'Our schedule is being prepared. Check back soon for upcoming classes.',
    classTypes: {
      reformer_group: 'Reformer Group',
      reformer_private: 'Reformer Private',
      reformer_duo: 'Reformer Duo',
      mat_group: 'Mat Group',
      mat_private: 'Mat Private',
      mat_duo: 'Mat Duo',
      chair: 'Chair Pilates',
      online: 'Online',
      sound_healing: 'Sound Healing',
      yoga: 'Yoga',
    }
  },
  de: {
    weeklySchedule: 'Wochenplan',
    tapToBook: 'Tippe auf eine Klasse, um dich anzumelden und auf {url} zu buchen. Die Verfügbarkeit wird alle paar Minuten aktualisiert.',
    bookNow: 'Jetzt buchen',
    poweredBy: 'Unterstützt durch',
    booking: 'Buchung',
    cancelled: 'Abgesagt',
    booked: '✓ Gebucht',
    full: 'Ausgebucht · Warteliste',
    spotsFree: '{spots} / {max} Plätze frei',
    credits: 'Credits',
    sessionCredits: 'Sitzungs-Credits',
    instructorUnavailable: 'Trainer nicht verfügbar',
    legend: 'Legende',
    today: 'Heute',
    previousWeek: 'Vorherige Woche',
    nextWeek: 'Nächste Woche',
    dayView: 'Tag',
    weekView: 'Woche',
    noClassesToday: 'Keine Klassen für diesen Tag geplant',
    comingSoonTitle: 'Demnächst verfügbar',
    comingSoonSubtitle: 'Unser Stundenplan wird gerade vorbereitet. Schau bald wieder vorbei für kommende Kurse.',
    classTypes: {
      reformer_group: 'Reformer Gruppe',
      reformer_private: 'Reformer Privat',
      reformer_duo: 'Reformer Duo',
      mat_group: 'Matten-Gruppe',
      mat_private: 'Matten-Privat',
      mat_duo: 'Matten-Duo',
      chair: 'Chair Pilates',
      online: 'Online',
      sound_healing: 'Sound Healing',
      yoga: 'Yoga',
    }
  },
  es: {
    weeklySchedule: 'Horario semanal',
    tapToBook: 'Toca una clase para iniciar sesión y reservar en {url}. La disponibilidad se actualiza cada pocos minutos.',
    bookNow: 'Reservar ahora',
    poweredBy: 'Desarrollado por',
    booking: 'reservas',
    cancelled: 'Cancelado',
    booked: '✓ Reservado',
    full: 'Completo · lista de espera',
    spotsFree: '{spots} / {max} plazas libres',
    credits: 'Créditos',
    sessionCredits: 'Créditos de sesión',
    instructorUnavailable: 'Instructor no disponible',
    legend: 'Leyenda',
    today: 'Hoy',
    previousWeek: 'Semana anterior',
    nextWeek: 'Semana siguiente',
    dayView: 'Día',
    weekView: 'Semana',
    noClassesToday: 'No hay clases programadas para este día',
    comingSoonTitle: 'Próximamente',
    comingSoonSubtitle: 'Nuestro horario está en preparación. Vuelve pronto para ver las próximas clases.',
    classTypes: {
      reformer_group: 'Grupo Reformer',
      reformer_private: 'Reformer Privado',
      reformer_duo: 'Reformer Dúo',
      mat_group: 'Grupo de Colchoneta',
      mat_private: 'Mat Privado',
      mat_duo: 'Mat Dúo',
      chair: 'Pilates Chair',
      online: 'En línea',
      sound_healing: 'Sanación por Sonido',
      yoga: 'Yoga',
    }
  }
} as const;
