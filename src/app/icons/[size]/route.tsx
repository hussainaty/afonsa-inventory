import { ImageResponse } from "next/og";
import { BrandMark } from "@/components/brand-mark";

const SIZES: Record<string, { size: number; padding: number }> = {
  "192": { size: 192, padding: 36 },
  "512": { size: 512, padding: 96 },
  maskable: { size: 512, padding: 128 },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size } = await ctx.params;
  const spec = SIZES[size];
  if (!spec) return new Response("Not found", { status: 404 });
  return new ImageResponse(<BrandMark size={spec.size} padding={spec.padding} />, {
    width: spec.size,
    height: spec.size,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
