import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { authSchema, invitation } from "@/db/schema";

function baseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

const trustedOrigins = [
  baseURL(),
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : undefined,
].filter((o): o is string => Boolean(o));

/**
 * Optional sign-up restriction. SIGNUP_ALLOWED_EMAILS is a comma-separated list of
 * emails and/or "@domain.com" entries. When set, only those addresses, or addresses
 * that hold a pending invitation, may create an account. Unset = open sign-up.
 */
async function assertSignupAllowed(email: string) {
  const raw = process.env.SIGNUP_ALLOWED_EMAILS?.trim();
  if (!raw) return;
  const address = email.trim().toLowerCase();
  const allowed = raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (allowed.some((a) => (a.startsWith("@") ? address.endsWith(a) : address === a))) return;
  const invited = await db.query.invitation.findFirst({
    where: and(
      eq(invitation.email, address),
      eq(invitation.status, "pending"),
      gt(invitation.expiresAt, new Date()),
    ),
    columns: { id: true },
  });
  if (!invited) {
    throw new APIError("FORBIDDEN", {
      message: "Sign-up is by invitation only. Ask the workspace owner for an invite link.",
    });
  }
}

export const auth = betterAuth({
  baseURL: baseURL(),
  trustedOrigins,
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Avoids a database read on every request (and every photo thumbnail).
    cookieCache: { enabled: true, maxAge: 300 },
  },
  rateLimit: {
    // Always on for deployments; the opt-out exists only for local end-to-end runs.
    enabled:
      process.env.NODE_ENV === "production" && (Boolean(process.env.VERCEL) || process.env.E2E_DISABLE_RATE_LIMIT !== "1"),
    window: 60,
    max: 60,
    // Shared across serverless instances; an in-memory counter would reset on every cold start.
    storage: "database",
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          await assertSignupAllowed(user.email);
        },
      },
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      creatorRole: "owner",
      // Deleting a workspace would cascade through the whole stock ledger; not offered.
      disableOrganizationDeletion: true,
      invitationExpiresIn: 60 * 60 * 48,
      // Free tier: no email provider. Invitations are shared as links from the Team page.
      async sendInvitationEmail() {},
    }),
    nextCookies(), // must be last so server actions can set auth cookies
  ],
});

export type Session = typeof auth.$Infer.Session;
