import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { db } from "@/db";
import { authSchema } from "@/db/schema";

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

export const auth = betterAuth({
  baseURL: baseURL(),
  trustedOrigins,
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  rateLimit: {
    // Always on for deployments; the opt-out exists only for local end-to-end runs.
    enabled:
      process.env.NODE_ENV === "production" && (Boolean(process.env.VERCEL) || process.env.E2E_DISABLE_RATE_LIMIT !== "1"),
    window: 60,
    max: 60,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
      invitationExpiresIn: 60 * 60 * 24 * 7,
      // Free tier: no email provider. Invitations are shared as links from the Team page.
      async sendInvitationEmail() {},
    }),
    nextCookies(), // must be last so server actions can set auth cookies
  ],
});

export type Session = typeof auth.$Infer.Session;
