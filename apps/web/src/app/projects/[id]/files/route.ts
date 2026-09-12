import { NextRequest, NextResponse } from "next/server"
import { projectService } from "../../../../services/house"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspace = projectService.getWorkspace(id)
    const files = await workspace.listFiles()

    return NextResponse.json({
      success: true,
      project: id,
      count: files.length,
      files
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Project not found"
      },
      { status: 404 }
    )
  }
}
