SELECT 'CREDIT_PACKAGES' AS section, name, credits_amount, price_cents / 100.0 AS price_eur, validity_weeks, category, credit_type, is_active FROM credit_packages WHERE is_active = true ORDER BY sort_order;

SELECT 'MEMBERSHIP_PLANS' AS section, name, weekly_credits, duration_weeks, price_cents / 100.0 AS price_eur, credit_type, is_active FROM membership_plans WHERE is_active = true ORDER BY sort_order;

SELECT 'CLASS_TEMPLATES' AS section, name, class_type, credit_cost, credit_type, max_capacity, is_welcome_journey, is_active FROM class_templates WHERE is_active = true ORDER BY class_type, name;

SELECT 'WELCOME_JOURNEY_CHECK' AS section, name, class_type, credit_cost, is_welcome_journey, is_active FROM class_templates WHERE is_welcome_journey = true;

SELECT 'YOGA_CHECK' AS section, name, class_type, credit_cost, credit_type, is_active FROM class_templates WHERE class_type = 'yoga';

SELECT 'USERS_COUNT' AS section, COUNT(*) AS total_users, COUNT(*) FILTER (WHERE welcome_completed_at IS NOT NULL) AS welcomed_users FROM users WHERE deleted_at IS NULL;

SELECT 'PENDING_WJ_REQUESTS' AS section, COUNT(*) AS count FROM welcome_journey_requests WHERE status IN ('pending', 'slots_offered');
