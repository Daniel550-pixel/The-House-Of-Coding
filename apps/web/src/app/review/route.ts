import { NextRequest, NextResponse } from "next/server"
import { reviewerAgent, workspace } from "../../services/house"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { path: filePath, code, language } = body ?? {}

    if (typeof filePath !== "string" && typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "path or code is required" },
        { status: 400 }
      )
    }

    const source = typeof code === "string"
      ? code
      : await workspace.readFile(filePath)

    const result = await reviewerAgent.review({
      code: source,
      language
    })

    return NextResponse.json({
      success: true,
      path: filePath ?? null,
      result
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Review failed"
      },
      { status: 500 }
    )
  }
}
