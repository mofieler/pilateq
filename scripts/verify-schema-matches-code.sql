SELECT 'TABLES' AS check_type, table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;

SELECT 'ENUMS' AS check_type, t.typname AS enum_name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' GROUP BY t.typname ORDER BY t.typname;

SELECT 'COLUMNS:credit_packages' AS check_type, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'credit_packages' ORDER BY ordinal_position;

SELECT 'COLUMNS:membership_plans' AS check_type, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'membership_plans' ORDER BY ordinal_position;

SELECT 'COLUMNS:class_templates' AS check_type, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'class_templates' ORDER BY ordinal_position;

SELECT 'COLUMNS:users' AS check_type, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;

SELECT 'COLUMNS:welcome_journey_requests' AS check_type, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'welcome_journey_requests' ORDER BY ordinal_position;

SELECT 'FK_CONSTRAINTS' AS check_type, tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS references_table FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name, tc.constraint_name;

SELECT 'INDEXES' AS check_type, tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
