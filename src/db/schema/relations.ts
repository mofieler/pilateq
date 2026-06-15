import { relations } from 'drizzle-orm';

// Users & Auth
import { users, accounts, sessions } from './users.schema';

// Studios
import { studios, studioSettings } from './studios.schema';

// Memberships
import { studioMemberships, studioInvites } from './memberships.schema';

// Instructors & Classes
import { instructors } from './instructors.schema';
import { classTemplates, classSessions } from './classes.schema';

// Booking & Waitlist
import { bookings } from './bookings.schema';
import { waitlistEntries } from './waitlist.schema';

// Credits & Billing
import {
  creditPackages,
  creditTransactions,
  creditPurchases,
  membershipPlans,
  userMemberships,
} from './credits.schema';

// Promos
import { promoCodes, promoUsages } from './promos.schema';

// Calendar
import { calendarConnections, externalCalendarBlocks } from './calendar.schema';

// Invoice Reminders
import { invoiceReminders } from './invoice-reminders.schema';

// Duo Invites
import { duoInvites } from './duo-invites.schema';

// Cancellation Mercy
import { cancellationMercyUses } from './cancellation-mercy.schema';

// Welcome Journey
import { welcomeJourneyRequests } from './welcome.schema';

// Audit Logs
import { auditLogs } from './audit-logs.schema';

// ─── users ───────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ one, many }) => ({
  instructor: one(instructors, {
    fields: [users.id],
    references: [instructors.userId],
  }),
  studioMemberships: many(studioMemberships, { relationName: 'membership_user' }),
  sentStudioInvites: many(studioInvites, { relationName: 'invite_sender' }),
  bookings: many(bookings),
  creditTransactions: many(creditTransactions, { relationName: 'transaction_owner' }),
  processedCreditTransactions: many(creditTransactions, { relationName: 'transaction_processor' }),
  creditPurchases: many(creditPurchases),
  userMemberships: many(userMemberships),
  waitlistEntries: many(waitlistEntries),
  accounts: many(accounts),
  sessions: many(sessions),
  promoUsages: many(promoUsages),
  calendarConnections: many(calendarConnections),
  duoInvitesAsOrganizer: many(duoInvites, { relationName: 'organizer_user' }),
  duoInvitesAsPartner: many(duoInvites, { relationName: 'partner_user' }),
  cancellationMercyUses: many(cancellationMercyUses),
  welcomeJourneyRequests: many(welcomeJourneyRequests),
  sentInvoiceReminders: many(invoiceReminders, { relationName: 'invoice_sender' }),
  auditLogs: many(auditLogs, { relationName: 'audit_user' }),
}));

// ─── accounts / sessions (Auth.js) ───────────────────────────────────────────
export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// ─── studios ─────────────────────────────────────────────────────────────────
export const studiosRelations = relations(studios, ({ one, many }) => ({
  settings: one(studioSettings, {
    fields: [studios.id],
    references: [studioSettings.studioId],
  }),
  studioMemberships: many(studioMemberships),
  studioInvites: many(studioInvites),
}));

// ─── instructors ─────────────────────────────────────────────────────────────
export const instructorsRelations = relations(instructors, ({ one, many }) => ({
  user: one(users, {
    fields: [instructors.userId],
    references: [users.id],
  }),
  classTemplates: many(classTemplates),
  classSessions: many(classSessions),
}));

// ─── classTemplates ──────────────────────────────────────────────────────────
export const classTemplatesRelations = relations(classTemplates, ({ one, many }) => ({
  instructor: one(instructors, {
    fields: [classTemplates.instructorId],
    references: [instructors.id],
  }),
  classSessions: many(classSessions),
}));

// ─── classSessions ───────────────────────────────────────────────────────────
export const classSessionsRelations = relations(classSessions, ({ one, many }) => ({
  template: one(classTemplates, {
    fields: [classSessions.templateId],
    references: [classTemplates.id],
  }),
  instructor: one(instructors, {
    fields: [classSessions.instructorId],
    references: [instructors.id],
  }),
  cancelledByUser: one(users, {
    fields: [classSessions.cancelledBy],
    references: [users.id],
  }),
  bookings: many(bookings),
  waitlistEntries: many(waitlistEntries),
  duoInvites: many(duoInvites),
}));

// ─── bookings ────────────────────────────────────────────────────────────────
export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  session: one(classSessions, { fields: [bookings.sessionId], references: [classSessions.id] }),
  creditTransactions: many(creditTransactions),
  duoInvitesAsOrganizer: many(duoInvites, { relationName: 'organizer_booking' }),
  duoInvitesAsPartner: many(duoInvites, { relationName: 'partner_booking' }),
  cancellationMercyUses: many(cancellationMercyUses),
}));

// ─── waitlistEntries ─────────────────────────────────────────────────────────
export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  user: one(users, { fields: [waitlistEntries.userId], references: [users.id] }),
  session: one(classSessions, {
    fields: [waitlistEntries.sessionId],
    references: [classSessions.id],
  }),
}));

// ─── creditPackages ──────────────────────────────────────────────────────────
export const creditPackagesRelations = relations(creditPackages, ({ many }) => ({
  creditTransactions: many(creditTransactions),
  creditPurchases: many(creditPurchases),
  promoCodes: many(promoCodes),
}));

// ─── creditPurchases ─────────────────────────────────────────────────────────
export const creditPurchasesRelations = relations(creditPurchases, ({ one, many }) => ({
  user: one(users, { fields: [creditPurchases.userId], references: [users.id] }),
  package: one(creditPackages, { fields: [creditPurchases.packageId], references: [creditPackages.id] }),
  promoCode: one(promoCodes, { fields: [creditPurchases.promoCodeId], references: [promoCodes.id] }),
  promoUsages: many(promoUsages),
  invoiceReminders: many(invoiceReminders),
}));

// ─── creditTransactions ──────────────────────────────────────────────────────
export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
    relationName: 'transaction_owner',
  }),
  processedByUser: one(users, {
    fields: [creditTransactions.processedBy],
    references: [users.id],
    relationName: 'transaction_processor',
  }),
  booking: one(bookings, {
    fields: [creditTransactions.bookingId],
    references: [bookings.id],
  }),
  purchase: one(creditPurchases, {
    fields: [creditTransactions.purchaseId],
    references: [creditPurchases.id],
  }),
}));

// ─── membershipPlans ─────────────────────────────────────────────────────────
export const membershipPlansRelations = relations(membershipPlans, ({ many }) => ({
  userMemberships: many(userMemberships),
}));

// ─── userMemberships ─────────────────────────────────────────────────────────
export const userMembershipsRelations = relations(userMemberships, ({ one }) => ({
  user: one(users, { fields: [userMemberships.userId], references: [users.id] }),
  plan: one(membershipPlans, { fields: [userMemberships.planId], references: [membershipPlans.id] }),
}));

// ─── promoCodes ──────────────────────────────────────────────────────────────
export const promoCodesRelations = relations(promoCodes, ({ one, many }) => ({
  package: one(creditPackages, { fields: [promoCodes.packageId], references: [creditPackages.id] }),
  usages: many(promoUsages),
}));

// ─── promoUsages ─────────────────────────────────────────────────────────────
export const promoUsagesRelations = relations(promoUsages, ({ one }) => ({
  promo: one(promoCodes, { fields: [promoUsages.promoId], references: [promoCodes.id] }),
  user: one(users, { fields: [promoUsages.userId], references: [users.id] }),
  purchase: one(creditPurchases, { fields: [promoUsages.purchaseId], references: [creditPurchases.id] }),
}));

// ─── calendarConnections ─────────────────────────────────────────────────────
export const calendarConnectionsRelations = relations(calendarConnections, ({ one, many }) => ({
  user: one(users, { fields: [calendarConnections.userId], references: [users.id] }),
  externalBlocks: many(externalCalendarBlocks),
}));

// ─── externalCalendarBlocks ──────────────────────────────────────────────────
export const externalCalendarBlocksRelations = relations(externalCalendarBlocks, ({ one }) => ({
  connection: one(calendarConnections, {
    fields: [externalCalendarBlocks.connectionId],
    references: [calendarConnections.id],
  }),
  instructor: one(instructors, {
    fields: [externalCalendarBlocks.instructorId],
    references: [instructors.id],
  }),
}));

// ─── invoiceReminders ────────────────────────────────────────────────────────
export const invoiceRemindersRelations = relations(invoiceReminders, ({ one }) => ({
  purchase: one(creditPurchases, {
    fields: [invoiceReminders.purchaseId],
    references: [creditPurchases.id],
  }),
  sentByAdmin: one(users, {
    fields: [invoiceReminders.sentByAdminId],
    references: [users.id],
    relationName: 'invoice_sender',
  }),
}));

// ─── duoInvites ──────────────────────────────────────────────────────────────
export const duoInvitesRelations = relations(duoInvites, ({ one }) => ({
  organizerBooking: one(bookings, {
    fields: [duoInvites.organizerBookingId],
    references: [bookings.id],
    relationName: 'organizer_booking',
  }),
  organizerUser: one(users, {
    fields: [duoInvites.organizerUserId],
    references: [users.id],
    relationName: 'organizer_user',
  }),
  session: one(classSessions, {
    fields: [duoInvites.sessionId],
    references: [classSessions.id],
  }),
  partnerBooking: one(bookings, {
    fields: [duoInvites.partnerBookingId],
    references: [bookings.id],
    relationName: 'partner_booking',
  }),
  partnerUser: one(users, {
    fields: [duoInvites.partnerUserId],
    references: [users.id],
    relationName: 'partner_user',
  }),
}));

// ─── cancellationMercyUses ───────────────────────────────────────────────────
export const cancellationMercyUsesRelations = relations(cancellationMercyUses, ({ one }) => ({
  user: one(users, { fields: [cancellationMercyUses.userId], references: [users.id] }),
  booking: one(bookings, {
    fields: [cancellationMercyUses.bookingId],
    references: [bookings.id],
  }),
}));

// ─── welcomeJourneyRequests ──────────────────────────────────────────────────
export const welcomeJourneyRequestsRelations = relations(welcomeJourneyRequests, ({ one }) => ({
  user: one(users, {
    fields: [welcomeJourneyRequests.userId],
    references: [users.id],
  }),
}));

// ─── studioMemberships ───────────────────────────────────────────────────────
export const studioMembershipsRelations = relations(studioMemberships, ({ one }) => ({
  user: one(users, {
    fields: [studioMemberships.userId],
    references: [users.id],
    relationName: 'membership_user',
  }),
  studio: one(studios, {
    fields: [studioMemberships.studioId],
    references: [studios.id],
  }),
  invitedByUser: one(users, {
    fields: [studioMemberships.invitedByUserId],
    references: [users.id],
  }),
}));

// ─── studioInvites ───────────────────────────────────────────────────────────
export const studioInvitesRelations = relations(studioInvites, ({ one }) => ({
  studio: one(studios, {
    fields: [studioInvites.studioId],
    references: [studios.id],
  }),
  invitedByUser: one(users, {
    fields: [studioInvites.invitedByUserId],
    references: [users.id],
    relationName: 'invite_sender',
  }),
}));

// ─── auditLogs ───────────────────────────────────────────────────────────────
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
    relationName: 'audit_user',
  }),
  studio: one(studios, {
    fields: [auditLogs.studioId],
    references: [studios.id],
  }),
}));
