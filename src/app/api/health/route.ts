import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Render checks this URL to confirm the app is alive.
// Returns 200 + a tiny JSON status. Also pings the DB so we fail-fast on
// connection issues during deploy.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 503 },
    );
  }
}
