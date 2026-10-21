import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, service: "classclash", db: "up" });
  } catch {
    return NextResponse.json({ ok: false, service: "classclash", db: "down" }, { status: 500 });
  }
}
