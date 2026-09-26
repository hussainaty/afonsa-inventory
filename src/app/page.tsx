import { redirect } from "next/navigation";
import { getContext } from "@/server/context";

export default async function Home() {
  const ctx = await getContext();
  if (!ctx) redirect("/sign-in");
  redirect(ctx.org ? "/dashboard" : "/onboarding");
}
