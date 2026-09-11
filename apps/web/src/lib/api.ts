const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    },
    cache: "no-store"
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error ?? `Request failed with HTTP ${response.status}`)
  }

  return data as T
}

export type WorkspaceFile = {
  path: string
  size: number
  extension: string
}

export type Project = {
  id: string
  name: string
  path: string
}

export type LanguageRuntime = {
  language: string
  extensions: string[]
  command: string
}

export type ExecutionResult = {
  language: string
  command: string
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
  success: boolean
}

export type AgentResult = {
  provider: string
  model: string
  content: string
}

export type SearchResult = {
  path: string
  line: number
  column: number
  text: string
}

export type WorkspaceSymbol = {
  name: string
  kind: "function" | "class" | "interface" | "type" | "variable" | "method"
  line: number
  column: number
  path: string
}

export function getProjects() {
  return request<{ success: boolean; projects: Project[] }>("/projects")
}

export function getProjectFiles(projectId: string) {
  return request<{ success: boolean; project: string; count: number; files: WorkspaceFile[] }>(`/projects/${projectId}/files`)
}

export function getProjectFile(projectId: string, path: string) {
  const query = new URLSearchParams({ path })
  return request<{ success: boolean; path: string; content: string }>(`/projects/${projectId}/file?${query.toString()}`)
}

export function saveProjectFile(projectId: string, path: string, content: string) {
  return request<{ success: boolean; path: string; bytes: number }>(`/projects/${projectId}/file`, {
    method: "POST",
    body: JSON.stringify({ path, content })
  })
}

export function searchProject(input: { projectId?: string; query: string }) {
  const query = new URLSearchParams({
    projectId: input.projectId ?? "house",
    q: input.query
  })

  return request<{
    success: boolean
    project: string
    query: string
    count: number
    truncated: boolean
    results: SearchResult[]
  }>(`/search?${query.toString()}`)
}

export function getWorkspaceSymbols(input: { projectId?: string; path?: string }) {
  const query = new URLSearchParams({ projectId: input.projectId ?? "house" })
  if (input.path) query.set("path", input.path)

  return request<{
    success: boolean
    project: string
    path?: string
    count: number
    symbols: WorkspaceSymbol[]
  }>(`/symbols?${query.toString()}`)
}

export function getLanguages() {
  return request<{ success: boolean; count: number; languages: LanguageRuntime[] }>("/languages")
}

export function generateCode(input: {
  instruction: string
  language?: string
  projectId?: string
  apply?: boolean
}) {
  return request<{
    success: boolean
    project: string
    result: {
      applied: boolean
      parsed?: boolean
      changes?: Array<{ path: string; content: string }>
      files?: string[]
      response?: string
    }
  }>("/code", {
    method: "POST",
    body: JSON.stringify(input)
  })
}

export function executeFile(input: { language: string; filePath: string; args?: string[] }) {
  return request<{ success: boolean; result: ExecutionResult }>("/execute", {
    method: "POST",
    body: JSON.stringify(input)
  })
}

export function analyzeTests(input: { path: string; language?: string }) {
  return request<{ success: boolean; path: string; result: AgentResult }>("/test/analyze", {
    method: "POST",
    body: JSON.stringify(input)
  })
}

export function debugCode(input: { error: string; code?: string; language?: string }) {
  return request<{ success: boolean; result: AgentResult }>("/debug", {
    method: "POST",
    body: JSON.stringify(input)
  })
}

export function reviewCode(input: { path?: string; code?: string; language?: string }) {
  return request<{ success: boolean; path: string | null; result: AgentResult }>("/review", {
    method: "POST",
    body: JSON.stringify(input)
  })
}

export function runAutonomous(input: {
  instruction: string
  language: string
  filePath: string
  maxIterations?: number
}) {
  return request<{
    success: boolean
    result: {
      success: boolean
      iteration: number
      events: Array<{
        iteration: number
        stage: "code" | "execute" | "debug" | "test" | "complete" | "failed"
        message: string
      }>
      execution?: ExecutionResult
      tests?: AgentResult
      debug?: AgentResult
    }
  }>("/autonomous", {
    method: "POST",
    body: JSON.stringify(input)
  })
}
