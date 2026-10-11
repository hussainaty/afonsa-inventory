import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { storageConfigured } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Liveness check, also called once a day by a Vercel cron (see vercel.json).
 * The daily query keeps the free Supabase project from pausing after a week
 * without activity. Reports no details beyond up/down.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json(
      { ok: true, database: "up", photoStorage: storageConfigured() ? "configured" : "not configured" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[health] database check failed", err);
    return NextResponse.json({ ok: false, database: "down" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
