import { NextRequest, NextResponse } from "next/server"
import { codingAgent, projectService } from "../../services/house"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      instruction,
      language,
      apply,
      projectId = "house"
    } = body ?? {}

    if (!instruction) {
      return NextResponse.json(
        { success: false, error: "instruction is required" },
        { status: 400 }
      )
    }

    projectService.getProject(projectId)

    const result = await codingAgent.execute({
      instruction,
      language,
      apply: apply !== false
    })

    return NextResponse.json({
      success: true,
      project: projectId,
      result
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Coding Agent failed"
      },
      { status: 500 }
    )
  }
}
