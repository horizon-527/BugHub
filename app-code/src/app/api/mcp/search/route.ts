import { NextRequest, NextResponse } from "next/server";
import { searchBugs, toSummary } from "@/lib/bug-search";

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

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rawLimit = sp.get("limit");
  const bugs = await searchBugs({
    q: sp.get("q") ?? undefined,
    domain: sp.get("domain") ?? undefined,
    pattern: sp.get("pattern") ?? undefined,
    category: sp.get("category") ?? undefined,
    severity: sp.get("severity") ?? undefined,
    limit: rawLimit ? Number(rawLimit) : undefined,
  });
  const withBody = sp.get("body") !== "0";
  const results = bugs.map((b) => (withBody ? { ...toSummary(b), body: b.body } : toSummary(b)));
  return NextResponse.json({ count: results.length, results }, { headers: CORS });
}
