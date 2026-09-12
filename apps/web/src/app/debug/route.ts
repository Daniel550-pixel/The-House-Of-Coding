import { NextRequest, NextResponse } from "next/server"
import { debuggerAgent } from "../../services/house"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { error: errMessage, code, language } = body ?? {}

    if (!errMessage) {
      return NextResponse.json(
        { success: false, error: "error is required" },
        { status: 400 }
      )
    }

    const result = await debuggerAgent.diagnose({
      error: errMessage,
      code,
      language
    })

    return NextResponse.json({
      success: true,
      result
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Debugger failed"
      },
      { status: 500 }
    )
  }
}
