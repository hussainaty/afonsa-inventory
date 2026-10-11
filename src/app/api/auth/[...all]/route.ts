import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handler = toNextJsHandler(auth);

// The browser only signs in, signs up, signs out and reads its session. Every
// workspace, member and invitation operation goes through server actions with
// explicit role checks, so the rest of Better Auth's HTTP API is not exposed
// (it would, for example, let any member list pending invitations).
const ALLOWED = new Set(["/sign-in/email", "/sign-up/email", "/sign-out", "/get-session", "/ok", "/error"]);

function allowed(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "").replace(/\/+$/, "");
  return ALLOWED.has(path);
}

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(request: Request) {
  return allowed(request) ? handler.GET(request) : notFound();
}

export async function POST(request: Request) {
  return allowed(request) ? handler.POST(request) : notFound();
}
