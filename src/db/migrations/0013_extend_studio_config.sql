-- Backfill new StudioConfig fields with safe defaults for existing studios.
-- The application loader also merges defaults at runtime; this is defensive.
UPDATE "studio_settings"
SET "config_json" = "config_json" || '{
  "onboardingState": {"currentStep": "welcome", "skipped": false},
  "featureVisibility": {
    "showCreditBalance": true,
    "showMemberships": true,
    "showClassPasses": false,
    "showWelcomeJourney": true,
    "showInvoices": true,
    "showEmbedSchedule": true,
    "showAdminBilling": true
  },
  "classCatalogStyle": {"cardLayout": "visual", "defaultSort": "time"},
  "paymentOptions": {
    "allowPartialPayment": false,
    "defaultPaymentProvider": "pay_at_studio",
    "showProcessingFees": false,
    "requireManualConfirmationForBankTransfer": true
  }
}'::jsonb
WHERE "config_json"->>'onboardingState' IS NULL;
