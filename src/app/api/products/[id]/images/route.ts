import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { AppError } from "@/server/common";
import { requireActionContext } from "@/server/context";
import { addProductImage, MAX_IMAGE_BYTES } from "@/server/images";
import { getStorage } from "@/server/storage";

// Photos are resized in the browser before upload, so requests stay well under
// Vercel's 4.5 MB request-body limit.
export async function POST(request: Request, ctx: RouteContext<"/api/products/[id]/images">) {
  try {
    const session = await requireActionContext();
    const { id } = await ctx.params;
    // Refuse before reading the body: a missing length could otherwise buffer anything.
    const length = Number(request.headers.get("content-length"));
    if (!Number.isFinite(length) || length <= 0) throw new AppError("Upload failed. Please try again.");
    if (length > MAX_IMAGE_BYTES + 64 * 1024) throw new AppError("Photos must be smaller than 4 MB");

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("Choose a photo to upload");
    if (file.size > MAX_IMAGE_BYTES) throw new AppError("Photos must be smaller than 4 MB");
    const dim = (k: string) => {
      const n = Number(form.get(k));
      return Number.isInteger(n) && n > 0 && n < 20_000 ? n : null;
    };

    const image = await addProductImage(db, getStorage(), session.org.id, session.user.id, id, {
      bytes: new Uint8Array(await file.arrayBuffer()),
      width: dim("width"),
      height: dim("height"),
    });
    revalidatePath("/", "layout");
    return NextResponse.json({ id: image.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[upload]", err);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
