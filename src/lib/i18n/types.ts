/**
 * i18n Type System
 *
 * Central type definitions for the translation layer.
 * All message keys are typed — adding a new language or domain
 * is compiler-checked.
 */

// ---------------------------------------------------------------------------
// Domain definitions
// ---------------------------------------------------------------------------

export interface CommonMessages {
  /** Navigation */
  'nav.home': string;
  'nav.book': string;
  'nav.myBookings': string;
  'nav.profile': string;
  'nav.admin': string;
  'nav.settings': string;
  'nav.logout': string;
  'nav.login': string;
  'nav.register': string;

  /** Generic actions */
  'action.save': string;
  'action.cancel': string;
  'action.delete': string;
  'action.edit': string;
  'action.close': string;
  'action.confirm': string;
  'action.back': string;
  'action.next': string;
  'action.submit': string;
  'action.search': string;
  'action.filter': string;
  'action.clear': string;
  'action.loading': string;
  'action.retry': string;

  /** Generic labels */
  'label.yes': string;
  'label.no': string;
  'label.or': string;
  'label.and': string;
  'label.from': string;
  'label.to': string;
  'label.at': string;
  'label.price': string;
  'label.free': string;
  'label.total': string;
  'label.subtotal': string;
  'label.tax': string;
  'label.date': string;
  'label.time': string;
  'label.duration': string;
  'label.capacity': string;
  'label.spotsLeft': string;
  'label.full': string;
  'label.waitlist': string;
  'label.confirmed': string;
  'label.cancelled': string;
  'label.pending': string;

  /** Studio */
  'studio.welcome': string;
  'studio.contact': string;
  'studio.address': string;
  'studio.phone': string;
  'studio.email': string;
}

export interface AuthMessages {
  'auth.login.title': string;
  'auth.login.subtitle': string;
  'auth.login.emailLabel': string;
  'auth.login.passwordLabel': string;
  'auth.login.forgotPassword': string;
  'auth.login.noAccount': string;
  'auth.login.registerLink': string;

  'auth.register.title': string;
  'auth.register.subtitle': string;
  'auth.register.nameLabel': string;
  'auth.register.emailLabel': string;
  'auth.register.passwordLabel': string;
  'auth.register.passwordHint': string;
  'auth.register.hasAccount': string;
  'auth.register.loginLink': string;
  'auth.register.termsPrefix': string;
  'auth.register.termsLink': string;

  'auth.forgot.title': string;
  'auth.forgot.subtitle': string;
  'auth.forgot.emailLabel': string;
  'auth.forgot.submit': string;
  'auth.forgot.backToLogin': string;
  'auth.forgot.success': string;

  'auth.reset.title': string;
  'auth.reset.passwordLabel': string;
  'auth.reset.passwordConfirmLabel': string;
  'auth.reset.submit': string;

  'auth.verify.title': string;
  'auth.verify.success': string;
  'auth.verify.error': string;
  'auth.verify.resend': string;

  'auth.completeProfile.title': string;
  'auth.completeProfile.phoneLabel': string;
  'auth.completeProfile.birthdayLabel': string;
  'auth.completeProfile.submit': string;

  'auth.error.invalidCredentials': string;
  'auth.error.accountExists': string;
  'auth.error.emailNotVerified': string;
  'auth.error.tooManyAttempts': string;
  'auth.error.sessionExpired': string;
}

export interface BookingMessages {
  'booking.title': string;
  'booking.subtitle': string;
  'booking.noClasses': string;
  'booking.noClassesSubtext': string;
  'booking.selectDate': string;
  'booking.classType': string;
  'booking.instructor': string;
  'booking.location': string;
  'booking.bookNow': string;
  'booking.joinWaitlist': string;
  'booking.alreadyBooked': string;
  'booking.classFull': string;

  'booking.detail.classInfo': string;
  'booking.detail.description': string;
  'booking.detail.whatToBring': string;
  'booking.detail.level': string;

  'booking.confirm.title': string;
  'booking.confirm.subtitle': string;
  'booking.confirm.creditsRequired': string;
  'booking.confirm.currentBalance': string;
  'booking.confirm.insufficientCredits': string;
  'booking.confirm.buyCredits': string;
  'booking.confirm.confirmBooking': string;

  'booking.success.title': string;
  'booking.success.message': string;
  'booking.success.addToCalendar': string;
  'booking.success.share': string;

  'booking.cancel.title': string;
  'booking.cancel.subtitle': string;
  'booking.cancel.policyTitle': string;
  'booking.cancel.policy24h': string;
  'booking.cancel.policyLate': string;
  'booking.cancel.mercyInfo': string;
  'booking.cancel.confirm': string;
  'booking.cancel.keepBooking': string;
  'booking.cancel.success': string;
  'booking.cancel.refundIssued': string;
  'booking.cancel.noRefund': string;

  'booking.myBookings.title': string;
  'booking.myBookings.upcoming': string;
  'booking.myBookings.past': string;
  'booking.myBookings.noUpcoming': string;
  'booking.myBookings.noPast': string;
  'booking.myBookings.cancelDeadline': string;

  'booking.duo.invitePartner': string;
  'booking.duo.partnerEmail': string;
  'booking.duo.sendInvite': string;
  'booking.duo.inviteSent': string;
  'booking.duo.inviteAccepted': string;

  'booking.welcome.required': string;
  'booking.welcome.completeFirst': string;
  'booking.welcome.startJourney': string;
}

export interface AdminMessages {
  'admin.dashboard.title': string;
  'admin.dashboard.subtitle': string;
  'admin.dashboard.todayClasses': string;
  'admin.dashboard.upcoming': string;
  'admin.dashboard.revenue': string;
  'admin.dashboard.newStudents': string;

  'admin.classes.title': string;
  'admin.classes.create': string;
  'admin.classes.schedule': string;
  'admin.classes.templates': string;
  'admin.classes.students': string;

  'admin.bookings.title': string;
  'admin.bookings.list': string;
  'admin.bookings.checkIn': string;
  'admin.bookings.cancel': string;

  'admin.students.title': string;
  'admin.students.list': string;
  'admin.students.credits': string;
  'admin.students.memberships': string;
  'admin.students.invite': string;

  'admin.payments.title': string;
  'admin.payments.overview': string;
  'admin.payments.transactions': string;
  'admin.payments.invoices': string;
  'admin.payments.manual': string;

  'admin.settings.title': string;
  'admin.settings.general': string;
  'admin.settings.businessModel': string;
  'admin.settings.payments': string;
  'admin.settings.classPasses': string;
  'admin.settings.classCatalog': string;
  'admin.settings.branding': string;
  'admin.settings.saved': string;
  'admin.settings.saveError': string;

  'admin.analytics.title': string;
  'admin.analytics.attendance': string;
  'admin.analytics.revenue': string;
  'admin.analytics.retention': string;

  'admin.instructors.title': string;
  'admin.instructors.list': string;
  'admin.instructors.schedule': string;
  'admin.instructors.payroll': string;
}

export interface BillingMessages {
  'billing.credits.title': string;
  'billing.credits.balance': string;
  'billing.credits.buy': string;
  'billing.credits.packages': string;
  'billing.credits.history': string;

  'billing.packages.title': string;
  'billing.packages.group': string;
  'billing.packages.session': string;
  'billing.packages.membership': string;
  'billing.packages.welcome': string;

  'billing.checkout.title': string;
  'billing.checkout.summary': string;
  'billing.checkout.method': string;
  'billing.checkout.pay': string;
  'billing.checkout.processing': string;
  'billing.checkout.success': string;
  'billing.checkout.error': string;

  'billing.payment.stripe': string;
  'billing.payment.bankTransfer': string;
  'billing.payment.cash': string;
  'billing.payment.payAtStudio': string;
  'billing.payment.manual': string;

  'billing.invoice.title': string;
  'billing.invoice.download': string;
  'billing.invoice.number': string;
  'billing.invoice.date': string;
  'billing.invoice.dueDate': string;

  'billing.membership.title': string;
  'billing.membership.active': string;
  'billing.membership.expired': string;
  'billing.membership.upcoming': string;
  'billing.membership.cancel': string;
}

export interface ErrorMessages {
  'error.generic': string;
  'error.notFound': string;
  'error.unauthorized': string;
  'error.forbidden': string;
  'error.rateLimited': string;
  'error.network': string;
  'error.timeout': string;
  'error.validation': string;
  'error.conflict': string;
  'error.maintenance': string;

  'error.booking.classFull': string;
  'error.booking.alreadyBooked': string;
  'error.booking.insufficientCredits': string;
  'error.booking.cancelWindowClosed': string;
  'error.booking.welcomeRequired': string;
  'error.booking.sessionStarted': string;

  'error.payment.failed': string;
  'error.payment.declined': string;
  'error.payment.expired': string;
}

// ---------------------------------------------------------------------------
// Full message bundle
// ---------------------------------------------------------------------------

export type MessageDomain = 'common' | 'auth' | 'booking' | 'admin' | 'billing' | 'errors';

export type Messages = CommonMessages & AuthMessages & BookingMessages & AdminMessages & BillingMessages & ErrorMessages;

export type Locale = 'en' | 'de' | 'es' | 'fr' | 'it' | 'nl';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'de', 'es'] as const;

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  nl: 'Nederlands',
};
