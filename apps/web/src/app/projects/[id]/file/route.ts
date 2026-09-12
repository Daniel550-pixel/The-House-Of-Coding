import { NextRequest, NextResponse } from "next/server"
import { projectService } from "../../../../services/house"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspace = projectService.getWorkspace(id)
    const filePath = request.nextUrl.searchParams.get("path") ?? ""

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: "path query parameter is required" },
        { status: 400 }
      )
    }

    const content = await workspace.readFile(filePath)

    return NextResponse.json({
      success: true,
      path: filePath,
      content
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to read file"
      },
      { status: 400 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspace = projectService.getWorkspace(id)
    const body = await request.json().catch(() => ({}))
    const { path: filePath, content } = body ?? {}

    if (typeof filePath !== "string" || typeof content !== "string") {
      return NextResponse.json(
        { success: false, error: "path and content are required" },
        { status: 400 }
      )
    }

    const result = await workspace.writeFile(filePath, content)

    return NextResponse.json(
      {
        success: true,
        ...result
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to write file"
      },
      { status: 400 }
    )
  }
}
