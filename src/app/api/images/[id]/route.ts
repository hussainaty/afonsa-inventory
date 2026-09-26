import { NextResponse } from "next/server";
import { db } from "@/db";
import { getContext } from "@/server/context";
import { getImageForMember } from "@/server/images";
import { getStorage } from "@/server/storage";

const SIGNED_URL_SECONDS = 60 * 60;

/** Serves a product photo to members of the photo's workspace only. */
export async function GET(_request: Request, ctx: RouteContext<"/api/images/[id]">) {
  const session = await getContext();
  if (!session?.org) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const image = await getImageForMember(db, session.org.id, id);
  if (!image) return new NextResponse("Not found", { status: 404 });

  const storage = getStorage();
  const url = await storage.signedUrl(image.storageKey, SIGNED_URL_SECONDS);
  if (url) {
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": `private, max-age=${SIGNED_URL_SECONDS - 300}` },
    });
  }
  const bytes = await storage.read(image.storageKey);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
