import { NextRequest, NextResponse } from "next/server"
import { testerAgent, workspace } from "../../../services/house"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { path: filePath, language } = body ?? {}

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "path is required" },
        { status: 400 }
      )
    }

    const code = await workspace.readFile(filePath)

    const result = await testerAgent.analyze({
      code,
      language
    })

    return NextResponse.json({
      success: true,
      path: filePath,
      result
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Test analysis failed"
      },
      { status: 400 }
    )
  }
}
