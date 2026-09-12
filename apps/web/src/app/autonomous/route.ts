import { NextRequest, NextResponse } from "next/server"
import { house } from "../../services/house"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      instruction,
      language,
      filePath,
      maxIterations
    } = body ?? {}

    if (!instruction || !language || !filePath) {
      return NextResponse.json(
        { success: false, error: "instruction, language and filePath are required" },
        { status: 400 }
      )
    }

    const result = await house.autonomousLoop.run({
      instruction,
      language,
      filePath,
      maxIterations
    })

    return NextResponse.json({
      success: result.success,
      result
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Autonomous loop failed"
      },
      { status: 500 }
    )
  }
}
