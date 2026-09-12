import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "the-house-of-coding-web",
    timestamp: new Date().toISOString()
  })
}
