import { NextResponse } from "next/server"
import { projectService } from "../../services/house"

export async function GET() {
  return NextResponse.json({
    success: true,
    projects: projectService.listProjects()
  })
}
