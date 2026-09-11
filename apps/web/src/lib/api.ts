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
    throw new Error(
      data?.error ?? `Request failed with HTTP ${response.status}`
    )
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

export function getProjects() {
  return request<{ success: boolean; projects: Project[] }>("/projects")
}

export function getProjectFiles(projectId: string) {
  return request<{
    success: boolean
    project: string
    count: number
    files: WorkspaceFile[]
  }>(`/projects/${projectId}/files`)
}

export function getProjectFile(projectId: string, path: string) {
  const query = new URLSearchParams({ path })

  return request<{
    success: boolean
    path: string
    content: string
  }>(`/projects/${projectId}/file?${query.toString()}`)
}

export function saveProjectFile(
  projectId: string,
  path: string,
  content: string
) {
  return request<{
    success: boolean
    path: string
    bytes: number
  }>(`/projects/${projectId}/file`, {
    method: "POST",
    body: JSON.stringify({ path, content })
  })
}

export function getLanguages() {
  return request<{
    success: boolean
    count: number
    languages: LanguageRuntime[]
  }>("/languages")
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
      files?: string[]
      response?: string
    }
  }>("/code", {
    method: "POST",
    body: JSON.stringify(input)
  })
}

export function executeFile(input: {
  language: string
  filePath: string
  args?: string[]
}) {
  return request<{
    success: boolean
    result: {
      language: string
      command: string
      stdout: string
      stderr: string
      exitCode: number
      durationMs: number
      success: boolean
    }
  }>("/execute", {
    method: "POST",
    body: JSON.stringify(input)
  })
}
