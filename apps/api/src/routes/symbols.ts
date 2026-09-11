import { Router } from "express"
import { projectService } from "../services/house"

const router = Router()
const MAX_FILE_SIZE = 512_000
const MAX_SYMBOLS = 200

export type WorkspaceSymbol = {
  name: string
  kind: "function" | "class" | "interface" | "type" | "variable" | "method"
  line: number
  column: number
  path: string
}

function addMatch(
  results: WorkspaceSymbol[],
  path: string,
  line: number,
  text: string,
  expression: RegExp,
  kind: WorkspaceSymbol["kind"]
) {
  const match = text.match(expression)
  if (!match?.[1]) return

  const name = match[1]
  const column = Math.max(text.indexOf(name), 0) + 1
  results.push({ name, kind, line, column, path })
}

function extractSymbols(path: string, content: string): WorkspaceSymbol[] {
  const results: WorkspaceSymbol[] = []
  const lines = content.split("\n")
  const extension = path.includes(".") ? `.${path.split(".").pop()}`.toLowerCase() : ""

  const patterns: Array<[RegExp, WorkspaceSymbol["kind"]]> = [
    [/^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/, "function"],
    [/^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/, "class"],
    [/^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/, "interface"],
    [/^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/, "type"],
    [/^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?:=|:)/, "variable"],
    [/^\s*(?:public|private|protected|static|async|get|set)?\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/, "method"]
  ]

  const supported = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".java", ".go", ".rs", ".php", ".rb", ".swift", ".kt", ".kts", ".cs", ".cpp", ".cc", ".c", ".h", ".hpp"
  ])

  if (!supported.has(extension)) return results

  for (let index = 0; index < lines.length && results.length < MAX_SYMBOLS; index += 1) {
    const text = lines[index] ?? ""

    for (const [expression, kind] of patterns) {
      addMatch(results, path, index + 1, text, expression, kind)
      if (results.length >= MAX_SYMBOLS) break
    }
  }

  return results
}

router.get("/", async (req, res) => {
  try {
    const projectId = String(req.query.projectId ?? "house")
    const requestedPath = String(req.query.path ?? "").trim()
    const workspace = projectService.getWorkspace(projectId)

    if (requestedPath) {
      const files = await workspace.listFiles()
      const file = files.find(item => item.path === requestedPath)
      if (!file) {
        return res.status(404).json({ success: false, error: "File not found" })
      }
      if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({ success: false, error: "File is too large to index" })
      }

      const content = await workspace.readFile(requestedPath)
      const symbols = extractSymbols(requestedPath, content)

      return res.json({
        success: true,
        project: projectId,
        path: requestedPath,
        count: symbols.length,
        symbols
      })
    }

    const files = await workspace.listFiles()
    const symbols: WorkspaceSymbol[] = []

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) continue
      const extracted = extractSymbols(file.path, await workspace.readFile(file.path))
      symbols.push(...extracted)
      if (symbols.length >= MAX_SYMBOLS) break
    }

    return res.json({
      success: true,
      project: projectId,
      count: Math.min(symbols.length, MAX_SYMBOLS),
      symbols: symbols.slice(0, MAX_SYMBOLS)
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Symbol extraction failed"
    })
  }
})

export default router
