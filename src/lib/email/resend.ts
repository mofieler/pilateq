// Barrel — re-exports all email functions so existing imports remain unchanged.
// Domain implementations live in the files below (each under 300 lines).

export * from './auth.emails';
export * from './booking.emails';
export * from './billing.emails';
export * from './membership.emails';
export * from './welcome.emails';
export * from './duo.emails';
export * from './invite.emails';
