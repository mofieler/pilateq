UPDATE credit_packages SET validity_weeks = 52, validity_days = 364, updated_at = NOW() WHERE name = 'Welcome Journey';
UPDATE credit_packages SET validity_weeks = 5,  validity_days = 35,  updated_at = NOW() WHERE name = 'Essence';
UPDATE credit_packages SET validity_weeks = 7,  validity_days = 49,  updated_at = NOW() WHERE name = 'Empower';
UPDATE credit_packages SET validity_weeks = 9,  validity_days = 63,  updated_at = NOW() WHERE name = 'Bloom';
UPDATE credit_packages SET validity_weeks = 12, validity_days = 84,  updated_at = NOW() WHERE name = 'Return to Life';

UPDATE membership_plans SET price_cents = 14500, updated_at = NOW() WHERE name ILIKE '%1%x%week%' OR name ILIKE '%1 x week%' OR name = '1x Week';
UPDATE membership_plans SET price_cents = 24500, updated_at = NOW() WHERE name ILIKE '%2%x%week%' OR name ILIKE '%2 x week%' OR name = '2x Week';

SELECT name, price_cents / 100.0 AS price_eur, validity_weeks, validity_days FROM credit_packages WHERE name IN ('Welcome Journey', 'Essence', 'Empower', 'Bloom', 'Return to Life') ORDER BY sort_order;
SELECT name, price_cents / 100.0 AS price_eur FROM membership_plans WHERE is_active = true ORDER BY sort_order, name;
