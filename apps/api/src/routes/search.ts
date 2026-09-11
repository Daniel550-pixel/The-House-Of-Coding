import { Router } from "express"
import { projectService } from "../services/house"

const router = Router()

const MAX_RESULTS = 100
const MAX_FILE_SIZE = 512_000

router.get("/", async (req, res) => {
  try {
    const projectId = String(req.query.projectId ?? "house")
    const query = String(req.query.q ?? "").trim()

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "q query parameter is required"
      })
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

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) continue

      let content: string
      try {
        content = await workspace.readFile(file.path)
      } catch {
        continue
      }

      const lines = content.split("\n")
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const text = lines[lineIndex] ?? ""
        const column = text.toLocaleLowerCase().indexOf(needle)
        if (column === -1) continue

        results.push({
          path: file.path,
          line: lineIndex + 1,
          column: column + 1,
          text: text.trim().slice(0, 240)
        })

        if (results.length >= MAX_RESULTS) break
      }

      if (results.length >= MAX_RESULTS) break
    }

    res.json({
      success: true,
      project: projectId,
      query,
      count: results.length,
      truncated: results.length >= MAX_RESULTS,
      results
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Workspace search failed"
    })
  }
})

export default router
