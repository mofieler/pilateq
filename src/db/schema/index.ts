// ─── Tables ───────────────────────────────────────────────────────────────────
export * from './users.schema';
export * from './instructors.schema';
export * from './classes.schema';
export * from './bookings.schema';
export * from './waitlist.schema';
export * from './credits.schema';
export * from './promos.schema';
export * from './calendar.schema';
export * from './invoice-reminders.schema';
export * from './duo-invites.schema';
export * from './cancellation-mercy.schema';
export * from './welcome.schema';
export * from './rate-limits.schema';
export * from './studio-claim-invites.schema';

export * from './audit-logs.schema';
export * from './studios.schema';
export * from './memberships.schema';
export * from './classpass-checkins.schema';


// ─── Enums ────────────────────────────────────────────────────────────────────
export * from './enums';

// ─── Relations ────────────────────────────────────────────────────────────────
export * from './relations';

// ─── Drizzle-inferred types ───────────────────────────────────────────────────
// Never define manual interfaces that duplicate these.
// Import these types throughout the application instead of writing your own.
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { users, accounts, sessions, verificationTokens } from './users.schema';
import type { instructors } from './instructors.schema';
import type { classTemplates, classSessions } from './classes.schema';
import type { bookings } from './bookings.schema';
import type { waitlistEntries } from './waitlist.schema';
import type { creditPackages, creditTransactions, creditPurchases, membershipPlans, userMemberships } from './credits.schema';
import type { promoCodes, promoUsages } from './promos.schema';
import type { calendarConnections, externalCalendarBlocks } from './calendar.schema';
import type { invoiceReminders } from './invoice-reminders.schema';
import type { duoInvites } from './duo-invites.schema';
import type { cancellationMercyUses } from './cancellation-mercy.schema';
import type { welcomeJourneyRequests } from './welcome.schema';
import type { rateLimits } from './rate-limits.schema';
import type { studioClaimInvites } from './studio-claim-invites.schema';
import type { auditLogs } from './audit-logs.schema';
import type { studioMemberships, studioInvites } from './memberships.schema';
import type {
  userRoleEnum,
  classTypeEnum,
  intensityLevelEnum,
  creditTypeEnum,
  bookingStatusEnum,
  sessionStatusEnum,
  cancellationTypeEnum,
  waitlistStatusEnum,
  creditTransactionTypeEnum,
  stripeTransactionStatusEnum,
  guestPassStatusEnum,
  vodStatusEnum,
  vodDifficultyEnum,
  badgeTriggerTypeEnum,
  duoInviteStatusEnum,
  invoiceReminderTypeEnum,
  membershipStatusEnum,
  studioMembershipRoleEnum,
  auditActionEnum,
} from './enums';

// Auth / user tables
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

export type VerificationToken = InferSelectModel<typeof verificationTokens>;
export type NewVerificationToken = InferInsertModel<typeof verificationTokens>;

// Instructors
export type Instructor = InferSelectModel<typeof instructors>;
export type NewInstructor = InferInsertModel<typeof instructors>;

// Classes
export type ClassTemplate = InferSelectModel<typeof classTemplates>;
export type NewClassTemplate = InferInsertModel<typeof classTemplates>;

export type ClassSession = InferSelectModel<typeof classSessions>;
export type NewClassSession = InferInsertModel<typeof classSessions>;

// Bookings
export type Booking = InferSelectModel<typeof bookings>;
export type NewBooking = InferInsertModel<typeof bookings>;

// Waitlist
export type WaitlistEntry = InferSelectModel<typeof waitlistEntries>;
export type NewWaitlistEntry = InferInsertModel<typeof waitlistEntries>;

// Credits
export type CreditPackage = InferSelectModel<typeof creditPackages>;
export type NewCreditPackage = InferInsertModel<typeof creditPackages>;

export type CreditTransaction = InferSelectModel<typeof creditTransactions>;
export type NewCreditTransaction = InferInsertModel<typeof creditTransactions>;

export type CreditPurchase = InferSelectModel<typeof creditPurchases>;
export type NewCreditPurchase = InferInsertModel<typeof creditPurchases>;

export type PromoCode = InferSelectModel<typeof promoCodes>;
export type NewPromoCode = InferInsertModel<typeof promoCodes>;

export type PromoUsage = InferSelectModel<typeof promoUsages>;
export type NewPromoUsage = InferInsertModel<typeof promoUsages>;

export type MembershipPlan = InferSelectModel<typeof membershipPlans>;
export type NewMembershipPlan = InferInsertModel<typeof membershipPlans>;

export type UserMembership = InferSelectModel<typeof userMemberships>;
export type NewUserMembership = InferInsertModel<typeof userMemberships>;

// Calendar
export type CalendarConnection = InferSelectModel<typeof calendarConnections>;
export type NewCalendarConnection = InferInsertModel<typeof calendarConnections>;

export type ExternalCalendarBlock = InferSelectModel<typeof externalCalendarBlocks>;
export type NewExternalCalendarBlock = InferInsertModel<typeof externalCalendarBlocks>;

// Invoice reminders
export type InvoiceReminder = InferSelectModel<typeof invoiceReminders>;
export type NewInvoiceReminder = InferInsertModel<typeof invoiceReminders>;

// Duo invites
export type DuoInvite = InferSelectModel<typeof duoInvites>;
export type NewDuoInvite = InferInsertModel<typeof duoInvites>;

// Cancellation mercy
export type CancellationMercyUse = InferSelectModel<typeof cancellationMercyUses>;
export type NewCancellationMercyUse = InferInsertModel<typeof cancellationMercyUses>;

// Welcome Journey
export type WelcomeJourneyRequest = InferSelectModel<typeof welcomeJourneyRequests>;
export type NewWelcomeJourneyRequest = InferInsertModel<typeof welcomeJourneyRequests>;

// Rate Limits
export type RateLimit = InferSelectModel<typeof rateLimits>;
export type NewRateLimit = InferInsertModel<typeof rateLimits>;

// Studio claim invites
export type StudioClaimInvite = InferSelectModel<typeof studioClaimInvites>;
export type NewStudioClaimInvite = InferInsertModel<typeof studioClaimInvites>;

// Audit Logs
export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;

// Studio memberships
export type StudioMembership = InferSelectModel<typeof studioMemberships>;
export type NewStudioMembership = InferInsertModel<typeof studioMemberships>;

export type StudioInvite = InferSelectModel<typeof studioInvites>;
export type NewStudioInvite = InferInsertModel<typeof studioInvites>;


// ─── Enum value types — use these instead of raw strings ─────────────────────
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type ClassType = (typeof classTypeEnum.enumValues)[number];
export type IntensityLevel = (typeof intensityLevelEnum.enumValues)[number];
export type CreditType = (typeof creditTypeEnum.enumValues)[number];
export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];
export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number];
export type CancellationType = (typeof cancellationTypeEnum.enumValues)[number];
export type WaitlistStatus = (typeof waitlistStatusEnum.enumValues)[number];
export type TransactionType = (typeof creditTransactionTypeEnum.enumValues)[number];
export type StripeTransactionStatus = (typeof stripeTransactionStatusEnum.enumValues)[number];
export type GuestPassStatus = (typeof guestPassStatusEnum.enumValues)[number];
export type VodStatus = (typeof vodStatusEnum.enumValues)[number];
export type VodDifficulty = (typeof vodDifficultyEnum.enumValues)[number];
export type BadgeTriggerType = (typeof badgeTriggerTypeEnum.enumValues)[number];
export type DuoInviteStatus = (typeof duoInviteStatusEnum.enumValues)[number];
export type InvoiceReminderType = (typeof invoiceReminderTypeEnum.enumValues)[number];
export type MembershipStatus = (typeof membershipStatusEnum.enumValues)[number];
export type StudioMembershipRole = (typeof studioMembershipRoleEnum.enumValues)[number];
export type AuditAction = (typeof auditActionEnum.enumValues)[number];
