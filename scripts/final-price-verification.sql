WITH expected_credit_packages AS (
  SELECT * FROM (VALUES
    ('Welcome Journey', 1, 12000, 52, 364, 'session', 'session'),
    ('Essence', 15, 11500, 5, 35, 'credit', 'pass'),
    ('Empower', 30, 22000, 7, 49, 'credit', 'pass'),
    ('Bloom', 50, 34000, 9, 63, 'credit', 'pass'),
    ('Return to Life', 100, 66000, 12, 84, 'credit', 'pass')
  ) AS t(name, credits_amount, price_cents, validity_weeks, validity_days, category, credit_type)
),
expected_memberships AS (
  SELECT * FROM (VALUES
    ('1x Week', 5, 4, 14500, 'pass'),
    ('2x Week', 5, 4, 24500, 'pass')
  ) AS t(name, weekly_credits, duration_weeks, price_cents, credit_type)
)
SELECT
  'CREDIT_PACKAGE' AS type,
  e.name,
  e.credits_amount AS expected_credits,
  cp.credits_amount AS actual_credits,
  e.price_cents / 100.0 AS expected_price,
  COALESCE(cp.price_cents, 0) / 100.0 AS actual_price,
  e.validity_weeks AS expected_weeks,
  COALESCE(cp.validity_weeks, 0) AS actual_weeks,
  CASE
    WHEN cp.id IS NULL THEN '❌ MISSING'
    WHEN cp.price_cents != e.price_cents THEN '❌ PRICE WRONG'
    WHEN cp.validity_weeks != e.validity_weeks THEN '❌ VALIDITY WRONG'
    WHEN cp.credits_amount != e.credits_amount THEN '❌ CREDITS WRONG'
    WHEN cp.category != e.category THEN '❌ CATEGORY WRONG'
    WHEN cp.credit_type::text != e.credit_type THEN '❌ CREDIT_TYPE WRONG'
    ELSE '✅ OK'
  END AS status
FROM expected_credit_packages e
LEFT JOIN credit_packages cp ON cp.name = e.name

UNION ALL

SELECT
  'MEMBERSHIP' AS type,
  e.name,
  e.weekly_credits AS expected_credits,
  mp.weekly_credits AS actual_credits,
  e.price_cents / 100.0 AS expected_price,
  COALESCE(mp.price_cents, 0) / 100.0 AS actual_price,
  e.duration_weeks AS expected_weeks,
  COALESCE(mp.duration_weeks, 0) AS actual_weeks,
  CASE
    WHEN mp.id IS NULL THEN '❌ MISSING'
    WHEN mp.price_cents != e.price_cents THEN '❌ PRICE WRONG'
    WHEN mp.weekly_credits != e.weekly_credits THEN '❌ WEEKLY CREDITS WRONG'
    WHEN mp.duration_weeks != e.duration_weeks THEN '❌ DURATION WRONG'
    WHEN mp.credit_type::text != e.credit_type THEN '❌ CREDIT_TYPE WRONG'
    ELSE '✅ OK'
  END AS status
FROM expected_memberships e
LEFT JOIN membership_plans mp ON mp.name = e.name

ORDER BY type, name;
