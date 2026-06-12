ALTER TABLE waitlist_entries DROP CONSTRAINT IF EXISTS waitlist_entries_session_id_class_sessions_id_fk;
ALTER TABLE waitlist_entries ADD CONSTRAINT waitlist_entries_session_id_fkey FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS credit_balances_user_type_unique_idx ON credit_balances(user_id, credit_type);
CREATE INDEX IF NOT EXISTS class_templates_type_idx ON class_templates(class_type);
