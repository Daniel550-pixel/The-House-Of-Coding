import { NextRequest, NextResponse } from "next/server"
import { execution, workspace } from "../../services/house"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { language, filePath, args } = body ?? {}

    if (!language || !filePath) {
      return NextResponse.json(
        { success: false, error: "language and filePath are required" },
        { status: 400 }
      )
    }

    const absolute = workspace.resolveSafe(filePath)

    const result = await execution.execute({
      language,
      filePath: absolute,
      workingDirectory: workspace.root,
      args
    })

    return NextResponse.json({
      success: true,
      result
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Execution failed"
      },
      { status: 400 }
    )
  }
}
