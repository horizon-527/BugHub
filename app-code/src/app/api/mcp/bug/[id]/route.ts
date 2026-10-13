import { NextResponse } from "next/server";
import { getBugByRoute } from "@/lib/data";
import { toSummary } from "@/lib/bug-search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const bug = await getBugByRoute(params.id);
  if (!bug) {
    return NextResponse.json({ error: "bug not found" }, { status: 404, headers: CORS });
  }
  return NextResponse.json(
    { ...toSummary(bug), categoryPath: bug.categoryPath, body: bug.body },
    { headers: CORS }
  );
}
