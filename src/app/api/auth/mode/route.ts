import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    dataSource: process.env.DATA_SOURCE || "mock",
    authMode: process.env.AUTH_MODE || "mock",
  });
}
