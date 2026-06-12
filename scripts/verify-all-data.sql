UPDATE credit_packages SET validity_weeks = 52, validity_days = 364, updated_at = NOW() WHERE name = 'Welcome Journey';

SELECT name, credits_amount, price_cents / 100.0 AS price_eur, validity_weeks, validity_days, category, credit_type, is_active, sort_order FROM credit_packages ORDER BY sort_order, name;

SELECT name, weekly_credits, duration_weeks, price_cents / 100.0 AS price_eur, credit_type, is_active, sort_order FROM membership_plans ORDER BY sort_order, name;

INSERT INTO membership_plans (id, name, description, credit_type, weekly_credits, duration_weeks, price_cents, currency, is_active, sort_order)
SELECT gen_random_uuid(), v.name, v.description, v.credit_type, v.weekly_credits, v.duration_weeks, v.price_cents, v.currency, v.is_active, v.sort_order
FROM (VALUES
  ('1x Week', '1 reformer + apparatus per week', 'pass', 5, 4, 14500, 'eur', true, 0),
  ('2x Week', '2 reformer + apparatus per week', 'pass', 5, 4, 24500, 'eur', true, 1)
) AS v(name, description, credit_type, weekly_credits, duration_weeks, price_cents, currency, is_active, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM membership_plans mp WHERE mp.name = v.name);

SELECT name, weekly_credits, duration_weeks, price_cents / 100.0 AS price_eur, credit_type, is_active, sort_order FROM membership_plans ORDER BY sort_order, name;
