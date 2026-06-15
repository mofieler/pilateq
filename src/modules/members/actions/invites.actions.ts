"use server";

import { z } from "zod";
import { db } from "@/db";
import { studioInvites, studioMemberships, users, studios } from "@/db/schema";
import { eq, and, isNull, desc, asc } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { requireStudioId } from "@/lib/studio/studio-context";
import {
  requireMembership,
  getMembership,
  createMembership,
  updateMembershipRole,
  createStudioInvite,
  getStudioInviteByTokenHash,
} from "@/lib/studio/membership";
import type { StudioMembershipRole } from "@/db/schema";
import { generateInviteToken, hashInviteToken } from "@/lib/tokens/inviteToken";
import { checkInviteRateLimits } from "@/lib/security/invite-rate-limiter";
import {
  checkRateLimit,
  inviteAcceptRateLimitConfig,
} from "@/lib/security/server-action-rate-limiter";
import { sendMemberInviteEmail } from "@/lib/email/member-invite.emails";
import { logAuditEvent } from "@/lib/security/audit-event";
import { APP_CONFIG } from "@/constants/APP_CONFIG";
import { formatStudio } from "@/lib/utils/date.utils";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

const { APP_NAME } = APP_CONFIG;
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getRequestBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost';
  const proto =
    headersList.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  return `${proto}://${host}`;
}

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

// ─── Schemas ──────────────────────────────────────────────────────────────────

const inviteMemberSchema = z.object({
  email: z
    .string()
    .email("Valid email is required")
    .max(255)
    .transform((v) => v.toLowerCase().trim()),
  role: z.enum(["owner", "admin", "instructor", "student"]),
  message: z.string().max(1000).optional().nullable(),
});

const tokenSchema = z.string().min(1).max(128);

const acceptInviteSchema = z.object({
  token: z.string().min(1).max(128),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(255)
    .optional()
    .nullable(),
});

const inviteIdSchema = z.string().uuid();

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "instructor", "student"]),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function maskToken(token: string): string {
  return `${token.slice(0, 8)}...`;
}

function emailToName(email: string): string {
  const local = email.split("@")[0] ?? "Studio Member";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 120);
}

function membershipRoleToUserRole(
  role: StudioMembershipRole,
): "student" | "instructor" | "admin" {
  if (role === "owner" || role === "admin") return "admin";
  if (role === "instructor") return "instructor";
  return "student";
}

async function getAdminInviteContext(): Promise<
  | { success: true; userId: string; studioId: string }
  | { success: false; error: string; code: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }

  try {
    const studioId = await requireStudioId();
    await requireMembership(session.user.id, studioId, ["owner", "admin"]);
    return { success: true, userId: session.user.id, studioId };
  } catch {
    return {
      success: false,
      error: "Insufficient studio permissions",
      code: "FORBIDDEN",
    };
  }
}

async function getStudioName(studioId: string): Promise<string> {
  const studio = await db
    .select({ name: studios.name })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1)
    .then((rows) => rows[0]);
  return studio?.name ?? APP_NAME;
}

// ─── Admin actions ────────────────────────────────────────────────────────────

export async function inviteMemberAction(
  input: unknown,
): Promise<ActionResult<{ inviteId: string; maskedToken: string }>> {
  const ctx = await getAdminInviteContext();
  if (!ctx.success) return ctx;

  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      code: "INVALID_INPUT",
    };
  }

  const { email, role, message } = parsed.data;

  // Only owners may invite other owners.
  if (role === "owner") {
    const callerMembership = await requireMembership(
      ctx.userId,
      ctx.studioId,
      "owner",
    ).catch(() => null);
    if (!callerMembership) {
      return {
        success: false,
        error: "Only studio owners can invite other owners.",
        code: "FORBIDDEN",
      };
    }
  }

  const rateLimits = await checkInviteRateLimits(ctx.userId, email);
  if (!rateLimits.adminLimit.success) {
    return {
      success: false,
      error: "Invite limit reached for your account. Please try again later.",
      code: "RATE_LIMITED",
    };
  }
  if (!rateLimits.emailLimit.success) {
    return {
      success: false,
      error: "This email address has received too many invites recently.",
      code: "RATE_LIMITED",
    };
  }

  // Block if the email already has an active membership in this studio.
  const existingMember = await db
    .select({ id: studioMemberships.id })
    .from(studioMemberships)
    .innerJoin(users, eq(studioMemberships.userId, users.id))
    .where(
      and(
        eq(studioMemberships.studioId, ctx.studioId),
        eq(users.email, email),
        eq(studioMemberships.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (existingMember) {
    return {
      success: false,
      error: "This user is already an active member of the studio.",
      code: "ALREADY_MEMBER",
    };
  }

  // Block duplicate active pending invite for the same studio + email.
  const existingPendingInvite = await db
    .select({ id: studioInvites.id, expiresAt: studioInvites.expiresAt })
    .from(studioInvites)
    .where(
      and(
        eq(studioInvites.studioId, ctx.studioId),
        eq(studioInvites.email, email),
        isNull(studioInvites.usedAt),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (existingPendingInvite && existingPendingInvite.expiresAt > new Date()) {
    return {
      success: false,
      error: "A pending invite already exists for this email address.",
      code: "ALREADY_INVITED",
    };
  }

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  const invite = await createStudioInvite({
    studioId: ctx.studioId,
    email,
    role,
    tokenHash,
    invitedBy: ctx.userId,
    expiresAt,
  });

  const studioName = await getStudioName(ctx.studioId);
  const inviter = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1)
    .then((rows) => rows[0]);

  const inviteUrl = `${await getRequestBaseUrl()}/join/${token}`;

  sendMemberInviteEmail({
    email,
    studioName,
    role,
    inviteUrl,
    invitedByName: inviter?.name ?? null,
    message: message ?? null,
    expiryDate: formatStudio(expiresAt, "d MMM 'at' HH:mm"),
  }).catch((err) =>
    console.error("[INVITE] Failed to send invite email:", err),
  );

  logAuditEvent({
    userId: ctx.userId,
    action: "invite_created",
    resource: "studio_invite",
    resourceId: invite.id,
    studioId: ctx.studioId,
    details: { email, role },
  });

  revalidatePath("/admin/members");
  return {
    success: true,
    data: { inviteId: invite.id, maskedToken: maskToken(token) },
  };
}

export async function resendInviteAction(
  inviteId: unknown,
): Promise<ActionResult<{ inviteId: string; maskedToken: string }>> {
  const ctx = await getAdminInviteContext();
  if (!ctx.success) return ctx;

  const parsed = inviteIdSchema.safeParse(inviteId);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid invite ID",
      code: "INVALID_INPUT",
    };
  }

  const invite = await db
    .select()
    .from(studioInvites)
    .where(
      and(
        eq(studioInvites.id, parsed.data),
        eq(studioInvites.studioId, ctx.studioId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!invite) {
    return { success: false, error: "Invite not found", code: "NOT_FOUND" };
  }

  if (invite.usedAt) {
    return {
      success: false,
      error: "This invite has already been used.",
      code: "ALREADY_USED",
    };
  }

  if (invite.expiresAt <= new Date()) {
    return {
      success: false,
      error: "This invite has expired. Create a new one instead.",
      code: "EXPIRED",
    };
  }

  const rateLimits = await checkInviteRateLimits(ctx.userId, invite.email);
  if (!rateLimits.adminLimit.success) {
    return {
      success: false,
      error: "Invite limit reached for your account. Please try again later.",
      code: "RATE_LIMITED",
    };
  }
  if (!rateLimits.emailLimit.success) {
    return {
      success: false,
      error: "This email address has received too many invites recently.",
      code: "RATE_LIMITED",
    };
  }

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  await db
    .update(studioInvites)
    .set({ tokenHash, expiresAt, updatedAt: new Date() })
    .where(eq(studioInvites.id, invite.id));

  const studioName = await getStudioName(ctx.studioId);
  const inviter = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1)
    .then((rows) => rows[0]);

  const inviteUrl = `${await getRequestBaseUrl()}/join/${token}`;

  sendMemberInviteEmail({
    email: invite.email,
    studioName,
    role: invite.role,
    inviteUrl,
    invitedByName: inviter?.name ?? null,
    message: null,
    expiryDate: formatStudio(expiresAt, "d MMM 'at' HH:mm"),
  }).catch((err) =>
    console.error("[INVITE] Failed to resend invite email:", err),
  );

  logAuditEvent({
    userId: ctx.userId,
    action: "invite_resent",
    resource: "studio_invite",
    resourceId: invite.id,
    studioId: ctx.studioId,
    details: { email: invite.email, role: invite.role },
  });

  revalidatePath("/admin/members");
  return {
    success: true,
    data: { inviteId: invite.id, maskedToken: maskToken(token) },
  };
}

export async function revokeInviteAction(
  inviteId: unknown,
): Promise<ActionResult> {
  const ctx = await getAdminInviteContext();
  if (!ctx.success) return ctx;

  const parsed = inviteIdSchema.safeParse(inviteId);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid invite ID",
      code: "INVALID_INPUT",
    };
  }

  const invite = await db
    .select()
    .from(studioInvites)
    .where(
      and(
        eq(studioInvites.id, parsed.data),
        eq(studioInvites.studioId, ctx.studioId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);

  if (!invite) {
    return { success: false, error: "Invite not found", code: "NOT_FOUND" };
  }

  if (invite.usedAt) {
    return {
      success: false,
      error: "This invite has already been used and cannot be revoked.",
      code: "ALREADY_USED",
    };
  }

  await db.delete(studioInvites).where(eq(studioInvites.id, invite.id));

  logAuditEvent({
    userId: ctx.userId,
    action: "invite_revoked",
    resource: "studio_invite",
    resourceId: invite.id,
    studioId: ctx.studioId,
    details: { email: invite.email, role: invite.role },
  });

  revalidatePath("/admin/members");
  return { success: true, data: undefined };
}

export type StudioInviteListItem = {
  id: string;
  email: string;
  role: StudioMembershipRole;
  createdAt: Date;
  expiresAt: Date;
  invitedByName: string | null;
};

export async function getStudioInvitesAction(): Promise<
  ActionResult<StudioInviteListItem[]>
> {
  const ctx = await getAdminInviteContext();
  if (!ctx.success) return ctx;

  const rows = await db
    .select({
      id: studioInvites.id,
      email: studioInvites.email,
      role: studioInvites.role,
      createdAt: studioInvites.createdAt,
      expiresAt: studioInvites.expiresAt,
      invitedByName: users.name,
    })
    .from(studioInvites)
    .leftJoin(
      users,
      and(eq(studioInvites.invitedByUserId, users.id), isNull(users.deletedAt)),
    )
    .where(
      and(
        eq(studioInvites.studioId, ctx.studioId),
        isNull(studioInvites.usedAt),
      ),
    )
    .orderBy(desc(studioInvites.createdAt));

  return { success: true, data: rows };
}

export type StudioMemberListItem = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: StudioMembershipRole;
  joinedAt: Date | null;
};

export async function getStudioMembersAction(): Promise<
  ActionResult<StudioMemberListItem[]>
> {
  const ctx = await getAdminInviteContext();
  if (!ctx.success) return ctx;

  const rows = await db
    .select({
      id: studioMemberships.id,
      userId: studioMemberships.userId,
      name: users.name,
      email: users.email,
      role: studioMemberships.role,
      joinedAt: studioMemberships.joinedAt,
    })
    .from(studioMemberships)
    .innerJoin(users, eq(studioMemberships.userId, users.id))
    .where(
      and(
        eq(studioMemberships.studioId, ctx.studioId),
        eq(studioMemberships.status, "active"),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(asc(studioMemberships.role), asc(users.name));

  return { success: true, data: rows };
}

export async function updateMemberRoleAction(
  input: unknown,
): Promise<ActionResult<{ userId: string; role: StudioMembershipRole }>> {
  const ctx = await getAdminInviteContext();
  if (!ctx.success) return ctx;

  const parsed = updateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      code: "INVALID_INPUT",
    };
  }

  const { userId: targetUserId, role } = parsed.data;

  // Owner-only operations: only owners can assign the owner role or change
  // another owner's role.
  if (role === 'owner') {
    const callerIsOwner = await requireMembership(
      ctx.userId,
      ctx.studioId,
      'owner',
    ).catch(() => null);
    if (!callerIsOwner) {
      return {
        success: false,
        error: 'Only studio owners can assign the owner role.',
        code: 'FORBIDDEN',
      };
    }
  }

  if (targetUserId !== ctx.userId) {
    const targetMembership = await getMembership(targetUserId, ctx.studioId);
    if (targetMembership?.role === 'owner') {
      const callerIsOwner = await requireMembership(
        ctx.userId,
        ctx.studioId,
        'owner',
      ).catch(() => null);
      if (!callerIsOwner) {
        return {
          success: false,
          error: 'Only studio owners can change another owner.',
          code: 'FORBIDDEN',
        };
      }
    }
  }

  try {
    const updated = await updateMembershipRole(
      targetUserId,
      ctx.studioId,
      role,
    );

    logAuditEvent({
      userId: ctx.userId,
      action: "member_role_changed",
      resource: "studio_membership",
      resourceId: targetUserId,
      studioId: ctx.studioId,
      details: { targetUserId, newRole: role },
    });

    revalidatePath("/admin/members");
    return {
      success: true,
      data: { userId: targetUserId, role: updated.role },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update role";
    return { success: false, error: message, code: "DB_ERROR" };
  }
}

// ─── Public invite actions ────────────────────────────────────────────────────

export type InviteValidationResult = {
  studioName: string;
  role: StudioMembershipRole;
  email: string;
  expiresAt: Date;
  invitedByName: string | null;
};

export async function validateInviteAction(
  token: unknown,
): Promise<ActionResult<InviteValidationResult>> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid invite link",
      code: "INVALID_INPUT",
    };
  }

  const tokenHash = hashInviteToken(parsed.data);
  const invite = await getStudioInviteByTokenHash(tokenHash);

  if (!invite) {
    return {
      success: false,
      error: "This invite link is not valid.",
      code: "NOT_FOUND",
    };
  }

  if (invite.usedAt) {
    return {
      success: false,
      error: "This invite has already been used.",
      code: "ALREADY_USED",
    };
  }

  if (invite.expiresAt <= new Date()) {
    return {
      success: false,
      error: "This invite has expired.",
      code: "EXPIRED",
    };
  }

  const studioName = await getStudioName(invite.studioId);
  const inviter = invite.invitedByUserId
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, invite.invitedByUserId))
        .limit(1)
        .then((rows) => rows[0])
    : null;

  return {
    success: true,
    data: {
      studioName,
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt,
      invitedByName: inviter?.name ?? null,
    },
  };
}

export type AcceptInviteResult = {
  userId: string;
  studioId: string;
  role: StudioMembershipRole;
};

export async function acceptInviteAction(
  input: unknown,
): Promise<ActionResult<AcceptInviteResult>> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      code: "INVALID_INPUT",
    };
  }

  const { token, password } = parsed.data;
  const tokenHash = hashInviteToken(token);

  const acceptRateLimit = await checkRateLimit(
    inviteAcceptRateLimitConfig,
    tokenHash,
  );
  if (!acceptRateLimit.success) {
    return {
      success: false,
      error: "Too many attempts. Please try again later.",
      code: "RATE_LIMITED",
    };
  }

  const invite = await getStudioInviteByTokenHash(tokenHash);
  if (!invite) {
    return {
      success: false,
      error: "This invite link is not valid.",
      code: "NOT_FOUND",
    };
  }

  if (invite.usedAt) {
    return {
      success: false,
      error: "This invite has already been used.",
      code: "ALREADY_USED",
    };
  }

  if (invite.expiresAt <= new Date()) {
    return {
      success: false,
      error: "This invite has expired.",
      code: "EXPIRED",
    };
  }

  const session = await auth();
  let targetUserId: string;

  if (session?.user?.id) {
    const sessionUser = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.id, session.user.id), isNull(users.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (
      !sessionUser ||
      normalizeEmail(sessionUser.email) !== normalizeEmail(invite.email)
    ) {
      return {
        success: false,
        error: "This invite was sent to a different email address.",
        code: "EMAIL_MISMATCH",
      };
    }

    targetUserId = session.user.id;
  } else {
    const existingUser = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(and(eq(users.email, invite.email), isNull(users.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (existingUser) {
      if (!password) {
        return {
          success: false,
          error: "Please sign in to accept this invitation.",
          code: "AUTH_REQUIRED",
        };
      }
      if (!existingUser.passwordHash) {
        return {
          success: false,
          error: "Please sign in with a social account or reset your password.",
          code: "AUTH_REQUIRED",
        };
      }
      const valid = await bcrypt.compare(password, existingUser.passwordHash);
      if (!valid) {
        return {
          success: false,
          error: "Incorrect password.",
          code: "INVALID_CREDENTIALS",
        };
      }
      targetUserId = existingUser.id;
    } else {
      if (!password) {
        return {
          success: false,
          error: "Please set a password to create your account.",
          code: "PASSWORD_REQUIRED",
        };
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const [newUser] = await db
        .insert(users)
        .values({
          email: invite.email,
          name: emailToName(invite.email),
          passwordHash,
          role: membershipRoleToUserRole(invite.role),
          studioId: invite.studioId,
          emailVerified: new Date(),
        })
        .returning();

      targetUserId = newUser.id;
    }
  }

  // Atomic consume: UPDATE only if usedAt is still NULL.
  const [consumed] = await db
    .update(studioInvites)
    .set({ usedAt: new Date(), updatedAt: new Date() })
    .where(
      and(eq(studioInvites.tokenHash, tokenHash), isNull(studioInvites.usedAt)),
    )
    .returning();

  if (!consumed) {
    return {
      success: false,
      error: "This invite has already been used.",
      code: "ALREADY_USED",
    };
  }

  // Create the membership. createMembership is idempotent and will re-activate
  // an existing row if the user was previously a member.
  await createMembership({
    userId: targetUserId,
    studioId: invite.studioId,
    role: invite.role,
    invitedBy: invite.invitedByUserId ?? undefined,
  });

  logAuditEvent({
    userId: targetUserId,
    action: "invite_accepted",
    resource: "studio_invite",
    resourceId: invite.id,
    studioId: invite.studioId,
    category: "user_action",
    severity: "low",
    details: { email: invite.email, role: invite.role },
  });

  revalidatePath(`/join/${token}`);
  return {
    success: true,
    data: {
      userId: targetUserId,
      studioId: invite.studioId,
      role: invite.role,
    },
  };
}
