import { NextRequest, NextResponse } from "next/server"
import { projectService } from "../../services/house"

const MAX_RESULTS = 100
const MAX_FILE_SIZE = 512_000
const IGNORED_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".woff", ".woff2", ".ttf", ".eot"
])

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") ?? "house"
    const query = (request.nextUrl.searchParams.get("q") ?? "").trim()

    if (!query) {
      return NextResponse.json(
        { success: false, error: "q query parameter is required" },
        { status: 400 }
      )
    }

    const workspace = projectService.getWorkspace(projectId)
    const files = await workspace.listFiles()
    const needle = query.toLocaleLowerCase()
    const results: Array<{
      path: string
      line: number
      column: number
      text: string
    }> = []

    outer: for (const file of files) {
      if (file.size > MAX_FILE_SIZE || IGNORED_EXTENSIONS.has(file.extension.toLocaleLowerCase())) continue

      let content: string
      try {
        content = await workspace.readFile(file.path)
      } catch {
        continue
      }

      const lines = content.split("\n")
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const text = lines[lineIndex] ?? ""
        const lowerText = text.toLocaleLowerCase()
        let cursor = 0

        while (cursor < lowerText.length) {
          const column = lowerText.indexOf(needle, cursor)
          if (column === -1) break

          results.push({
            path: file.path,
            line: lineIndex + 1,
            column: column + 1,
            text: text.trim().slice(0, 240)
          })

          if (results.length >= MAX_RESULTS) break outer
          cursor = column + Math.max(needle.length, 1)
        }
      }
    }

    return NextResponse.json({
      success: true,
      project: projectId,
      query,
      count: results.length,
      truncated: results.length >= MAX_RESULTS,
      results
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Workspace search failed"
      },
      { status: 400 }
    )
  }
}
