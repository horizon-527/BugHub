import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/data";

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

export async function GET() {
  const catalog = await getCatalog();
  const categories = catalog.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    count: c.count,
    subcategories: c.children.map((s) => ({ id: s.id, name: s.name, count: s.bugs.length })),
  }));
  return NextResponse.json(
    { total: categories.reduce((n, c) => n + c.count, 0), categoryCount: categories.length, categories },
    { headers: CORS }
  );
}
