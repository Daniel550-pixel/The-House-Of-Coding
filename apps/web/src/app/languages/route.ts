import { NextResponse } from "next/server"
import { runtimeRegistry } from "../../services/house"

export async function GET() {
  return NextResponse.json({
    success: true,
    count: runtimeRegistry.all().length,
    languages: runtimeRegistry.all()
  })
}
