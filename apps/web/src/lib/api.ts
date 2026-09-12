const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ""

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
  signature?: string
}

export type AgentEvent = {
  iteration: number
  stage: "code" | "execute" | "debug" | "test" | "complete" | "failed"
  agent: "coding" | "runtime" | "debugger" | "tester" | "orchestrator"
  action: string
  message: string
  nextAgent?: "coding" | "runtime" | "debugger" | "tester" | "orchestrator"
  durationMs?: number
}

export type AgentSession = {
  id: string
  request: {
    instruction: string
    language: string
    filePath: string
    maxIterations?: number
  }
  status: "queued" | "running" | "completed" | "failed"
  createdAt: string
  startedAt?: string
  completedAt?: string
  activeAgent?: AgentEvent["agent"]
  activeAction?: string
  activeIteration?: number
  lastTransitionAt?: string
  events: AgentEvent[]
  result?: unknown
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

export function saveProjectFile(
  projectIdOrInput: string | { projectId?: string; path: string; content: string },
  maybePath?: string,
  maybeContent?: string
) {
  let projectId = "house"
  let path = ""
  let content = ""

  if (typeof projectIdOrInput === "object") {
    projectId = projectIdOrInput.projectId ?? "house"
    path = projectIdOrInput.path
    content = projectIdOrInput.content
  } else {
    projectId = projectIdOrInput
    path = maybePath ?? ""
    content = maybeContent ?? ""
  }

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

export function runFleetCode(input: { instruction: string; language?: string; projectId?: string; apply?: boolean }) {
  return generateCode(input)
}

export function runFleetDebug(input: { error: string; code?: string; language?: string }) {
  return debugCode(input)
}

export function runFleetTest(input: { path: string; language?: string }) {
  return analyzeTests(input)
}

export function runFleetReview(input: { path?: string; code?: string; language?: string }) {
  return reviewCode(input)
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
      events: AgentEvent[]
      execution?: ExecutionResult
      tests?: AgentResult
      debug?: AgentResult
    }
  }>("/autonomous", {
    method: "POST",
    body: JSON.stringify(input)
  })
}

export function createAgentSession(input: AgentSession["request"]) {
  return request<{ success: boolean; session: AgentSession }>("/sessions", {
    method: "POST",
    body: JSON.stringify(input)
  })
}

export function getAgentSessions(limit = 25) {
  const query = new URLSearchParams({ limit: String(limit) })
  return request<{ success: boolean; sessions: AgentSession[] }>(`/sessions?${query.toString()}`)
}

export function getAgentSession(id: string) {
  return request<{ success: boolean; session: AgentSession }>(`/sessions/${id}`)
}

export function subscribeAgentSession(
  id: string,
  onEvent: (event: AgentEvent) => void,
  onSession?: (session: AgentSession) => void,
  onError?: (error: Event) => void
) {
  const source = new EventSource(`${API_BASE}/sessions/${id}/events`)

  source.onmessage = event => {
    try {
      const payload = JSON.parse(event.data) as { type?: string; session?: AgentSession } | AgentEvent
      if ("type" in payload && payload.type === "session" && payload.session) onSession?.(payload.session)
      else if ("stage" in payload) onEvent(payload)
    } catch {
      // Ignore malformed stream messages.
    }
  }

  source.onerror = event => onError?.(event)
  return () => source.close()
}
