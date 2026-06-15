import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'student',
  'instructor',
  'admin',
  'superadmin',
]);

export const studioMembershipRoleEnum = pgEnum('studio_membership_role', [
  'owner',
  'admin',
  'instructor',
  'student',
]);

export const studioStatusEnum = pgEnum('studio_status', [
  'onboarding',
  'active',
  'suspended',
  'paused',
]);

export const classTypeEnum = pgEnum('class_type', [
  'reformer_group',   // Group class on the reformer
  'reformer_private', // 1-on-1 private reformer session
  'reformer_duo',     // 2-person reformer session
  'mat_group',        // Group mat Pilates class
  'mat_private',      // 1-on-1 private mat session
  'mat_duo',          // 2-person mat session
  'chair',            // Chair Pilates — uses group credits
  'online',           // Virtual / online class — uses group credits
  'sound_healing',    // Sound healing session — uses group credits (no dedicated package)
  'yoga',             // Yoga class — uses group credits
]);

export const sessionTypeEnum = pgEnum('session_type', ['group', 'private']);

export const intensityLevelEnum = pgEnum('intensity_level', ['low', 'medium', 'high', 'varied']);

export const sessionStatusEnum = pgEnum('session_status', [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'confirmed',
  'cancelled',
  'attended',
  'no_show',
  'waitlisted',
]);

export const cancellationTypeEnum = pgEnum('cancellation_type', [
  'user_cancelled',
  'instructor_cancelled',
  'admin_cancelled',
]);

export const creditTypeEnum = pgEnum('credit_type', [
  'pass',          // universal pass — covers every group class (mat, reformer, chair, yoga, sound). Cost per class is set on classTemplates.creditCost.
  'mat_pass',      // mat-only pass — covers mat group, chair, yoga, sound healing, online. NOT reformer.
  'reformer_pass', // reformer-only pass — covers reformer group. NOT mat/chair/yoga.
  'session',       // private 1:1 and duo sessions — mat=3 credits, reformer=5 credits, set on classTemplates.creditCost
]);

export const creditTransactionTypeEnum = pgEnum('credit_transaction_type', [
  'purchase',
  'debit',
  'refund',
  'adjustment',
  'membership_grant',
  'expiry',
]);

export const stripeTransactionStatusEnum = pgEnum('stripe_transaction_status', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
]);

export const waitlistStatusEnum = pgEnum('waitlist_status', [
  'waiting',
  'offered',
  'confirmed',
  'expired',
  'cancelled',
]);

export const guestPassStatusEnum = pgEnum('guest_pass_status', ['active', 'redeemed', 'expired']);

export const duoInviteStatusEnum = pgEnum('duo_invite_status', [
  'pending',   // created, awaiting partner
  'accepted',  // partner confirmed + booked
  'expired',   // expiresAt passed without acceptance
  'cancelled', // organizer cancelled their booking
]);

export const invoiceReminderTypeEnum = pgEnum('invoice_reminder_type', [
  'overdue_reminder', // admin triggers dunning email to user
  'custom_send',      // admin sends invoice to arbitrary email address
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'stripe',
  'pay_at_studio',
  'bank_transfer',
  'cash',
  'sound_healing_credits',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'overdue',
  'refunded'
]);

export const creditPackCategoryEnum = pgEnum('credit_pack_category', [
  'credit',   // Group class credit packages (mat_group, reformer_group, private_session tiers)
  'session',  // Private session packages (mat/reformer class types)
]);

export const vodStatusEnum = pgEnum('vod_status', [
  'processing',
  'published',
  'unlisted',
  'archived',
]);

export const vodDifficultyEnum = pgEnum('vod_difficulty', ['beginner', 'intermediate', 'advanced']);

export const badgeTriggerTypeEnum = pgEnum('badge_trigger_type', [
  'classes_attended',
  'streak',
  'purchases',
  'special',
]);

export const membershipStatusEnum = pgEnum('membership_status', [
  'active',
  'paused',
  'cancelled',
  'expired',
]);

export const sessionSubtypeEnum = pgEnum('session_subtype', ['private', 'duo']);

export const auditActionEnum = pgEnum('audit_action', [
  'INSERT',
  'UPDATE',
  'DELETE',
]);
