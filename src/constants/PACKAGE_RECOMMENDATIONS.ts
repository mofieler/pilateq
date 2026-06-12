// User-facing copy for the package recommender. Kept as a flat constants
// module so that a future move to next-intl is a mechanical rename — no
// string-concatenation in the components.

export const RECOMMENDER_COPY = {
  intentLabel: 'What classes are you interested in?',
  intentOptions: {
    all: 'All classes',
    mat_only: 'Mat only',
  },

  frequencyLabel: 'How often per week?',
  frequencyOptions: {
    once: 'Once a week',
    multiple: 'Multiple times a week',
  },

  matOnlyHint: 'Mat-only classes are currently scheduled once a week, so smaller packs fit best.',

  disabledReasons: {
    heads_up_validity_short: 'Heads up: validity is too short for once-a-week practice.',
  },
} as const;
