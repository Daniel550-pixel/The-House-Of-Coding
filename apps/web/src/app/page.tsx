"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FolderOpen,
  Hash,
  Play,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Terminal,
  X,
  Wand2
} from "lucide-react"
import { AutonomousControls, type AgentAction } from "../components/autonomous-controls"
import {
  executeFile,
  generateCode,
  getLanguages,
  getProjectFile,
  getProjectFiles,
  getProjects,
  saveProjectFile,
  searchProject,
  type LanguageRuntime,
  type Project,
  type SearchResult,
  type WorkspaceFile
} from "../lib/api"

type Message = {
  role: "user" | "assistant"
  content: string
}

type TreeNode = {
  name: string
  path: string
  kind: "file" | "folder"
  children: TreeNode[]
}

type OpenTab = {
  path: string
  content: string
  savedContent: string
}

type Diagnostic = {
  line: number
  column?: number
  source?: string
  message: string
}

const PROJECT_ID = "house"
const DEFAULT_FILE = "apps/web/src/app/page.tsx"

function fileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

function detectLanguage(filePath: string, languages: LanguageRuntime[]) {
  const extension = filePath.includes(".")
    ? `.${filePath.split(".").pop()}`.toLowerCase()
    : ""

  return languages.find(runtime =>
    runtime.extensions.some(item => item.toLowerCase() === extension)
  )?.language ?? "typescript"
}

function formatError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function buildTree(files: WorkspaceFile[]): TreeNode[] {
  const root: TreeNode = { name: "root", path: "", kind: "folder", children: [] }

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split("/").filter(Boolean)
    let current = root

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1
      const path = parts.slice(0, index + 1).join("/")
      let node = current.children.find(child => child.name === part)

      if (!node) {
        node = { name: part, path, kind: isFile ? "file" : "folder", children: [] }
        current.children.push(node)
      }

      current = node
    })
  }

  return root.children
}

function lineNumbers(value: string) {
  return value.split("\n").map((_, index) => index + 1)
}

function lineStartIndex(value: string, line: number) {
  if (line <= 1) return 0
  let currentLine = 1
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\n") {
      currentLine += 1
      if (currentLine === line) return index + 1
    }
  }
  return value.length
}

function parseDiagnostics(value: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const seen = new Set<string>()

  const patterns = [
    /^(.+?):(\d+):(\d+):\s*(?:error|warning)?\s*:??\s*(.+)$/gm,
    /^(.+?):(\d+):\s*(?:error|warning)?\s*:??\s*(.+)$/gm,
    /^(.+?)\((\d+),(\d+)\):\s*(.+)$/gm
  ]

  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      const source = match[1]?.trim()
      const line = Number(match[2])
      const column = match[3] ? Number(match[3]) : undefined
      const message = (match[4] ?? "").trim()
      if (!Number.isInteger(line) || line < 1 || !message) continue

      const key = `${source}:${line}:${column ?? ""}:${message}`
      if (seen.has(key)) continue
      seen.add(key)
      diagnostics.push({ line, column, source, message })
    }
  }

  return diagnostics.slice(0, 12)
}

function AgentTreeNode({
  node,
  depth,
  selectedFile,
  openTabs,
  onOpen
}: {
  node: TreeNode
  depth: number
  selectedFile: string
  openTabs: OpenTab[]
  onOpen: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isSelected = node.kind === "file" && node.path === selectedFile
  const isOpen = node.kind === "file" && openTabs.some(tab => tab.path === node.path)

  if (node.kind === "folder") {
    return (
      <div>
        <button
          onClick={() => setExpanded(value => !value)}
          className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <FolderOpen size={15} />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded && node.children.map(child => (
          <AgentTreeNode key={child.path} node={child} depth={depth + 1} selectedFile={selectedFile} openTabs={openTabs} onOpen={onOpen} />
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => onOpen(node.path)}
      className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm ${
        isSelected
          ? "bg-neutral-900 text-white"
          : isOpen
            ? "text-neutral-300"
            : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
      }`}
      style={{ paddingLeft: `${22 + depth * 12}px` }}
      title={node.path}
    >
      <FileCode2 size={14} />
      <span className="truncate">{node.name}</span>
      {isOpen && <span className="ml-auto mr-1 h-1.5 w-1.5 rounded-full bg-neutral-500" />}
    </button>
  )
}

export default function Home() {
  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [languages, setLanguages] = useState<LanguageRuntime[]>([])
  const [selectedFile, setSelectedFile] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState("typescript")
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [prompt, setPrompt] = useState("")
  const [search, setSearch] = useState("")
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState("")
  const [globalResults, setGlobalResults] = useState<SearchResult[]>([])
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const [editorSearchOpen, setEditorSearchOpen] = useState(false)
  const [editorQuery, setEditorQuery] = useState("")
  const [editorMatchIndex, setEditorMatchIndex] = useState(0)
  const [goToLineOpen, setGoToLineOpen] = useState(false)
  const [goToLineValue, setGoToLineValue] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [output, setOutput] = useState("")
  const [outputKind, setOutputKind] = useState<"execution" | "agent" | "system">("system")
  const [lastAgentAction, setLastAgentAction] = useState<AgentAction | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState("Connecting to workspace")
  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const editorSearchRef = useRef<HTMLInputElement | null>(null)
  const goToLineRef = useRef<HTMLInputElement | null>(null)
  const globalSearchRef = useRef<HTMLInputElement | null>(null)
  const openingFilesRef = useRef(new Set<string>())

  const filteredFiles = useMemo(
    () => search.trim()
      ? files.filter(file => file.path.toLowerCase().includes(search.trim().toLowerCase()))
      : files,
    [files, search]
  )
  const visibleTree = useMemo(() => buildTree(filteredFiles), [filteredFiles])
  const uniqueTabs = useMemo(() => {
    const seen = new Set<string>()
    return openTabs.filter(tab => {
      if (seen.has(tab.path)) return false
      seen.add(tab.path)
      return true
    })
  }, [openTabs])
  const activeTab = uniqueTabs.find(tab => tab.path === selectedFile)
  const code = activeTab?.content ?? ""
  const dirty = Boolean(activeTab && activeTab.content !== activeTab.savedContent)
  const selectedRuntime = useMemo(
    () => languages.find(item => item.language === selectedLanguage),
    [languages, selectedLanguage]
  )
  const numbers = useMemo(() => lineNumbers(code), [code])
  const editorMatches = useMemo(() => {
    if (!editorQuery) return []
    const source = code.toLocaleLowerCase()
    const query = editorQuery.toLocaleLowerCase()
    const matches: number[] = []
    let cursor = 0
    while (cursor < source.length) {
      const index = source.indexOf(query, cursor)
      if (index === -1) break
      matches.push(index)
      cursor = index + Math.max(query.length, 1)
    }
    return matches
  }, [code, editorQuery])
  const diagnostics = useMemo(() => parseDiagnostics(output), [output])

  useEffect(() => {
    if (openTabs.length === uniqueTabs.length) return
    setOpenTabs(uniqueTabs)
  }, [openTabs.length, uniqueTabs])

  useEffect(() => setEditorMatchIndex(0), [editorQuery, selectedFile])

  useEffect(() => {
    if (editorSearchOpen) requestAnimationFrame(() => editorSearchRef.current?.focus())
  }, [editorSearchOpen])

  useEffect(() => {
    if (goToLineOpen) requestAnimationFrame(() => goToLineRef.current?.focus())
  }, [goToLineOpen])

  useEffect(() => {
    if (globalSearchOpen) requestAnimationFrame(() => globalSearchRef.current?.focus())
  }, [globalSearchOpen])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA"

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault()
        setGlobalSearchOpen(true)
        return
      }

      if (!editing && (event.ctrlKey || event.metaKey) && event.key === "PageDown" && uniqueTabs.length > 1) {
        event.preventDefault()
        const currentIndex = Math.max(uniqueTabs.findIndex(tab => tab.path === selectedFile), 0)
        const nextTab = uniqueTabs[(currentIndex + 1) % uniqueTabs.length]
        setSelectedFile(nextTab.path)
        setSelectedLanguage(detectLanguage(nextTab.path, languages))
        return
      }

      if (!editing && (event.ctrlKey || event.metaKey) && event.key === "PageUp" && uniqueTabs.length > 1) {
        event.preventDefault()
        const currentIndex = Math.max(uniqueTabs.findIndex(tab => tab.path === selectedFile), 0)
        const nextTab = uniqueTabs[(currentIndex - 1 + uniqueTabs.length) % uniqueTabs.length]
        setSelectedFile(nextTab.path)
        setSelectedLanguage(detectLanguage(nextTab.path, languages))
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [languages, selectedFile, uniqueTabs])

  useEffect(() => {
    if (!globalSearchOpen || globalQuery.trim().length < 2) {
      setGlobalResults([])
      setGlobalSearchLoading(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setGlobalSearchLoading(true)
      try {
        const result = await searchProject({ projectId: PROJECT_ID, query: globalQuery.trim() })
        if (!cancelled) setGlobalResults(result.results)
      } catch {
        if (!cancelled) setGlobalResults([])
      } finally {
        if (!cancelled) setGlobalSearchLoading(false)
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [globalQuery, globalSearchOpen])

  function selectEditorMatch(index: number) {
    if (!editorMatches.length) return
    const normalized = (index + editorMatches.length) % editorMatches.length
    setEditorMatchIndex(normalized)
    const start = editorMatches[normalized]
    const end = start + editorQuery.length
    requestAnimationFrame(() => {
      editorRef.current?.focus()
      editorRef.current?.setSelectionRange(start, end)
    })
  }

  function goToLine() {
    const target = Number(goToLineValue)
    if (!Number.isInteger(target) || target < 1 || !selectedFile) return
    const safeLine = Math.min(target, numbers.length)
    const index = lineStartIndex(code, safeLine)
    setGoToLineOpen(false)
    setGoToLineValue("")
    requestAnimationFrame(() => {
      editorRef.current?.focus()
      editorRef.current?.setSelectionRange(index, index)
    })
    setStatus(`Line ${safeLine}`)
  }

  async function refreshWorkspace() {
    setStatus("Refreshing workspace")
    try {
      const [projectData, fileData, languageData] = await Promise.all([getProjects(), getProjectFiles(PROJECT_ID), getLanguages()])
      setProject(projectData.projects[0] ?? null)
      setFiles(fileData.files)
      setLanguages(languageData.languages)
      setStatus("Ready")
    } catch (error) {
      setStatus(formatError(error, "Workspace unavailable"))
    }
  }

  async function openFile(path: string, targetLine?: number, targetColumn?: number) {
    if (openingFilesRef.current.has(path)) return

    const existing = uniqueTabs.find(tab => tab.path === path)
    if (existing) {
      setSelectedFile(path)
      setSelectedLanguage(detectLanguage(path, languages))
      setOutput("")
      requestAnimationFrame(() => {
        if (!targetLine) return
        const indexAtLine = lineStartIndex(existing.content, targetLine)
        const cursor = Math.min(indexAtLine + Math.max((targetColumn ?? 1) - 1, 0), existing.content.length)
        editorRef.current?.focus()
        editorRef.current?.setSelectionRange(cursor, cursor)
      })
      return
    }

    openingFilesRef.current.add(path)
    setStatus(`Opening ${path}`)
    try {
      const result = await getProjectFile(PROJECT_ID, path)
      setOpenTabs(current => {
        const existingIndex = current.findIndex(tab => tab.path === path)
        if (existingIndex >= 0) return current
        return [...current, { path, content: result.content, savedContent: result.content }]
      })
      setSelectedFile(path)
      setSelectedLanguage(detectLanguage(path, languages))
      setOutput("")
      setStatus("Ready")
      requestAnimationFrame(() => {
        if (!targetLine) return
        const indexAtLine = lineStartIndex(result.content, targetLine)
        const cursor = Math.min(indexAtLine + Math.max((targetColumn ?? 1) - 1, 0), result.content.length)
        editorRef.current?.focus()
        editorRef.current?.setSelectionRange(cursor, cursor)
      })
    } catch (error) {
      setStatus(formatError(error, "Unable to open file"))
    } finally {
      openingFilesRef.current.delete(path)
    }
  }

  function updateCode(value: string) {
    setOpenTabs(current => current.map(tab => tab.path === selectedFile ? { ...tab, content: value } : tab))
    setStatus("Unsaved changes")
  }

  async function saveTab(path = selectedFile) {
    const tab = uniqueTabs.find(item => item.path === path)
    if (!tab || saving) return
    setSaving(true)
    setStatus(`Saving ${path}`)
    try {
      await saveProjectFile(PROJECT_ID, path, tab.content)
      setOpenTabs(current => current.map(item => item.path === path ? { ...item, savedContent: item.content } : item))
      setStatus("Saved")
    } catch (error) {
      setStatus(formatError(error, "Save failed"))
    } finally {
      setSaving(false)
    }
  }

  function closeTab(path: string) {
    const tab = uniqueTabs.find(item => item.path === path)
    if (!tab) return
    if (tab.content !== tab.savedContent && !window.confirm(`${fileName(path)} has unsaved changes. Close anyway?`)) return

    const next = uniqueTabs.filter(item => item.path !== path)
    setOpenTabs(next)
    if (selectedFile === path) {
      const nextTab = next[next.length - 1]
      setSelectedFile(nextTab?.path ?? "")
      if (nextTab) setSelectedLanguage(detectLanguage(nextTab.path, languages))
    }
  }

  async function runCurrentFile() {
    if (!selectedFile || running) return
    const tab = uniqueTabs.find(item => item.path === selectedFile)
    if (!tab) return
    setRunning(true)
    setOutput("Saving current file...\n")
    setOutputKind("execution")
    setLastAgentAction(null)
    try {
      await saveTab(selectedFile)
      const result = await executeFile({ language: selectedLanguage, filePath: selectedFile })
      setOutput([`STATUS: ${result.result.success ? "SUCCESS" : "FAILED"}`, `Command: ${result.result.command}`, `Exit code: ${result.result.exitCode}`, `Duration: ${result.result.durationMs} ms`, "", "STDOUT", result.result.stdout || "(none)", "", "STDERR", result.result.stderr || "(none)"].join("\n"))
      setStatus(result.result.success ? "Execution successful" : "Execution failed")
    } catch (error) {
      setOutput(formatError(error, "Execution failed"))
      setStatus("Execution failed")
    } finally {
      setRunning(false)
    }
  }

  async function sendPrompt() {
    if (!prompt.trim() || loading) return
    const instruction = prompt.trim()
    setMessages(current => [...current, { role: "user", content: instruction }])
    setPrompt("")
    setLoading(true)
    try {
      const result = await generateCode({ instruction: `${instruction}\n\nThe currently selected file is ${selectedFile || "none"}. Preserve unrelated files unless a change is required.`, language: selectedLanguage, projectId: PROJECT_ID, apply: true })
      const changedFiles = result.result.files?.length ? `\n\nChanged files:\n${result.result.files.join("\n")}` : ""
      setMessages(current => [...current, { role: "assistant", content: `${result.result.response ?? "No response returned."}${changedFiles}` }])
      await refreshWorkspace()
      if (selectedFile) await openFile(selectedFile)
      setOutputKind("agent")
      setLastAgentAction("code")
      setOutput(result.result.response ?? "Coding Agent completed.")
    } catch (error) {
      setMessages(current => [...current, { role: "assistant", content: formatError(error, "Unable to reach the Coding Agent.") }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshWorkspace() }, [])

  useEffect(() => {
    if (!selectedFile && files.some(file => file.path === DEFAULT_FILE)) void openFile(DEFAULT_FILE)
  }, [files, selectedFile])

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex h-16 items-center justify-between border-b border-neutral-800 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-black"><Wand2 size={18} /></div>
          <div className="min-w-0"><div className="text-sm font-semibold tracking-wide">THE HOUSE OF CODING</div><div className="truncate text-xs text-neutral-500">{project?.name ?? "Workspace"}</div></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void refreshWorkspace()} className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:text-white" title="Refresh workspace"><RefreshCw size={16} /></button>
          <AutonomousControls language={selectedLanguage} filePath={selectedFile} code={code} instruction={prompt} onOutput={(value, action) => { setOutputKind("agent"); setLastAgentAction(action ?? null); setOutput(value) }} onFilesChanged={() => { void refreshWorkspace(); if (selectedFile) void openFile(selectedFile) }} />
          <div className="hidden items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 xl:flex"><span className="text-xs text-neutral-500">Language</span><select value={selectedLanguage} onChange={event => setSelectedLanguage(event.target.value)} className="bg-transparent text-sm outline-none">{languages.map(language => <option key={language.language} value={language.language} className="bg-neutral-900">{language.language}</option>)}</select><ChevronDown size={14} /></div>
          <button onClick={() => void runCurrentFile()} disabled={running || !selectedFile} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50"><Play size={15} />{running ? "Running" : "Run"}</button>
          <button onClick={() => void saveTab()} disabled={saving || !dirty} className="rounded-lg border border-neutral-800 p-2 text-neutral-300 disabled:opacity-40" title={dirty ? "Save changes" : "Saved"}><Save size={17} /></button>
          <button className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:text-white" title="Settings"><Settings size={17} /></button>
        </div>
      </header>

      {globalSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pt-[12vh]" onMouseDown={() => setGlobalSearchOpen(false)}>
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-neutral-700 bg-neutral-950 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
              <Search size={17} className="text-neutral-500" />
              <input
                ref={globalSearchRef}
                value={globalQuery}
                onChange={event => setGlobalQuery(event.target.value)}
                onKeyDown={event => { if (event.key === "Escape") setGlobalSearchOpen(false) }}
                placeholder="Search workspace..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-600"
              />
              <kbd className="rounded border border-neutral-800 px-1.5 py-1 text-[10px] text-neutral-600">Ctrl P</kbd>
              <button onClick={() => setGlobalSearchOpen(false)} className="rounded p-1 text-neutral-500 hover:bg-neutral-900 hover:text-white"><X size={14} /></button>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              {globalQuery.trim().length < 2 ? (
                <div className="px-4 py-8 text-center text-xs text-neutral-600">Type at least 2 characters to search the workspace.</div>
              ) : globalSearchLoading ? (
                <div className="px-4 py-8 text-center text-xs text-neutral-600">Searching workspace...</div>
              ) : globalResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-neutral-600">No matches.</div>
              ) : (
                <div className="divide-y divide-neutral-900">
                  {globalResults.map((result, index) => (
                    <button
                      key={`${result.path}:${result.line}:${result.column}:${index}`}
                      onClick={() => {
                        setGlobalSearchOpen(false)
                        void openFile(result.path, result.line, result.column)
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-900"
                    >
                      <FileCode2 size={14} className="mt-0.5 shrink-0 text-neutral-600" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-neutral-300"><span className="truncate">{result.path}</span><span className="shrink-0 text-[10px] text-neutral-600">{result.line}:{result.column}</span></div>
                        <div className="mt-1 truncate font-mono text-[11px] text-neutral-600">{result.text}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="grid min-h-[calc(100vh-4rem)] grid-cols-[250px_minmax(0,1fr)_380px]">
        <aside className="min-w-0 border-r border-neutral-800">
          <div className="flex h-11 items-center justify-between border-b border-neutral-800 px-4"><span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Explorer</span><span className="text-[11px] text-neutral-600">{files.length} files</span></div>
          <div className="border-b border-neutral-800 p-2"><div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-2"><Search size={14} className="text-neutral-600" /><input id="file-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search files" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-neutral-600" />{search && <button onClick={() => setSearch("")} className="text-neutral-600 hover:text-white"><X size={13} /></button>}</div></div>
          <div className="border-b border-neutral-800 px-4 py-2 text-[11px] text-neutral-600">{status}</div>
          <div className="h-[calc(100vh-9.5rem)] overflow-auto p-2">
            <div className="mb-2 flex items-center gap-2 px-2 py-1.5 text-sm text-neutral-200"><FolderOpen size={15} /><span className="truncate">{project?.name ?? "the-house-of-coding"}</span></div>
            {visibleTree.map(node => <AgentTreeNode key={node.path} node={node} depth={0} selectedFile={selectedFile} openTabs={uniqueTabs} onOpen={path => void openFile(path)} />)}
            {search && visibleTree.length === 0 && <div className="px-3 py-4 text-xs text-neutral-600">No matching files.</div>}
          </div>
        </aside>

        <section className="grid min-w-0 grid-rows-[42px_40px_minmax(0,1fr)_220px]">
          <div className="flex min-w-0 items-center justify-between border-b border-neutral-800 px-4"><div className="flex min-w-0 items-center gap-3 text-sm"><FileCode2 size={15} /><span className="truncate">{selectedFile || "No file selected"}</span><span className="hidden text-xs text-neutral-600 md:inline">{selectedRuntime?.command ?? "runtime unavailable"}</span></div><span className={`text-xs ${dirty ? "text-neutral-300" : "text-neutral-600"}`}>{dirty ? "Unsaved" : status}</span></div>
          <div className="flex min-w-0 items-center overflow-x-auto border-b border-neutral-800 bg-neutral-950">
            {uniqueTabs.map(tab => {
              const active = tab.path === selectedFile
              const tabDirty = tab.content !== tab.savedContent
              return <div key={tab.path} className={`group flex h-full shrink-0 items-center border-r border-neutral-800 ${active ? "bg-neutral-900" : "bg-neutral-950"}`}><button onClick={() => { setSelectedFile(tab.path); setSelectedLanguage(detectLanguage(tab.path, languages)) }} className={`flex h-full items-center gap-2 px-3 text-xs ${active ? "text-white" : "text-neutral-500 hover:text-neutral-300"}`} title={tab.path}><FileCode2 size={13} />{fileName(tab.path)}{tabDirty && <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />}</button><button onClick={() => closeTab(tab.path)} className="mr-1 rounded p-1 text-neutral-700 opacity-0 transition group-hover:opacity-100 hover:bg-neutral-800 hover:text-white" title="Close tab"><X size={12} /></button></div>
            })}
          </div>
          <div className="relative grid min-h-0 grid-cols-[54px_minmax(0,1fr)] bg-[#0b0b0b]">
            <div className="select-none overflow-hidden border-r border-neutral-900 bg-[#090909] px-3 pt-4 text-right font-mono text-xs leading-7 text-neutral-700">{numbers.map(number => <div key={number}>{number}</div>)}</div>
            <textarea
              ref={editorRef}
              value={code}
              onChange={event => updateCode(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Tab") {
                  event.preventDefault()
                  const start = event.currentTarget.selectionStart
                  const end = event.currentTarget.selectionEnd
                  updateCode(`${code.slice(0, start)}  ${code.slice(end)}`)
                  requestAnimationFrame(() => {
                    event.currentTarget.selectionStart = start + 2
                    event.currentTarget.selectionEnd = start + 2
                  })
                }
                if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
                  event.preventDefault()
                  setEditorSearchOpen(false)
                  document.getElementById("file-search")?.focus()
                } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
                  event.preventDefault()
                  setEditorSearchOpen(true)
                }
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
                  event.preventDefault()
                  setGoToLineOpen(true)
                }
                if (event.key === "Escape") {
                  setEditorSearchOpen(false)
                  setGoToLineOpen(false)
                }
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                  event.preventDefault()
                  void saveTab()
                }
              }}
              spellCheck={false}
              wrap="off"
              disabled={!selectedFile}
              className="h-full w-full resize-none overflow-auto bg-transparent px-4 py-4 font-mono text-sm leading-7 text-neutral-200 outline-none disabled:cursor-default"
              aria-label={`Editor for ${selectedFile || "no file"}`}
            />
            {editorSearchOpen && (
              <div className="absolute right-4 top-3 z-20 flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-2xl">
                <Search size={14} className="text-neutral-500" />
                <input ref={editorSearchRef} value={editorQuery} onChange={event => setEditorQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); selectEditorMatch(editorMatchIndex + (event.shiftKey ? -1 : 1)) } if (event.key === "Escape") setEditorSearchOpen(false) }} placeholder="Find in file" className="w-48 bg-transparent text-xs outline-none placeholder:text-neutral-600" />
                <span className="min-w-[42px] text-right text-[10px] text-neutral-500">{editorMatches.length ? `${editorMatchIndex + 1}/${editorMatches.length}` : "0/0"}</span>
                <button onClick={() => selectEditorMatch(editorMatchIndex - 1)} disabled={!editorMatches.length} className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white disabled:opacity-30" title="Previous match">↑</button>
                <button onClick={() => selectEditorMatch(editorMatchIndex + 1)} disabled={!editorMatches.length} className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white disabled:opacity-30" title="Next match">↓</button>
                <button onClick={() => setEditorSearchOpen(false)} className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white" title="Close search"><X size={13} /></button>
              </div>
            )}
            {goToLineOpen && (
              <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 p-2 shadow-2xl">
                <Hash size={14} className="text-neutral-500" />
                <input ref={goToLineRef} inputMode="numeric" value={goToLineValue} onChange={event => setGoToLineValue(event.target.value.replace(/[^0-9]/g, ""))} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); goToLine() } if (event.key === "Escape") setGoToLineOpen(false) }} placeholder={`Go to line 1-${numbers.length}`} className="w-40 bg-transparent text-xs outline-none placeholder:text-neutral-600" />
                <button onClick={goToLine} disabled={!goToLineValue} className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-black disabled:opacity-30">Go</button>
                <button onClick={() => setGoToLineOpen(false)} className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white"><X size={13} /></button>
              </div>
            )}
          </div>
          <div className="border-t border-neutral-800">
            <div className="flex h-10 items-center justify-between border-b border-neutral-800 px-4 text-xs">
              <div className="flex items-center gap-2 text-neutral-200"><Terminal size={14} />{outputKind === "execution" ? "Terminal" : outputKind === "agent" ? "Agent Output" : "Output"}</div>
              <div className="flex items-center gap-2">
                {outputKind === "agent" && lastAgentAction && <span className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-[10px] uppercase tracking-widest text-neutral-500">{lastAgentAction} agent</span>}
                <span className="text-neutral-600">{selectedLanguage}</span>
              </div>
            </div>
            {diagnostics.length > 0 && (
              <div className="max-h-20 overflow-auto border-b border-neutral-800 bg-neutral-950 px-4 py-2">
                <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-neutral-500"><AlertTriangle size={12} />Detected diagnostics</div>
                <div className="space-y-1">
                  {diagnostics.map((diagnostic, index) => (
                    <button key={`${diagnostic.source ?? "diagnostic"}-${diagnostic.line}-${diagnostic.column ?? ""}-${index}`} onClick={() => { const indexAtLine = lineStartIndex(code, diagnostic.line); const columnOffset = Math.max((diagnostic.column ?? 1) - 1, 0); const cursor = Math.min(indexAtLine + columnOffset, code.length); editorRef.current?.focus(); editorRef.current?.setSelectionRange(cursor, cursor) }} className="block w-full truncate text-left font-mono text-[10px] text-neutral-500 hover:text-neutral-200" title={diagnostic.message}><span className="mr-2 text-neutral-700">L{diagnostic.line}{diagnostic.column ? `:${diagnostic.column}` : ""}</span>{diagnostic.message}</button>
                  ))}
                </div>
              </div>
            )}
            <pre className="h-[calc(100%-2.5rem)] overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-5 text-neutral-400">{output || "Execution, diagnostics, tests, reviews, and autonomous events will appear here."}</pre>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col border-l border-neutral-800">
          <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3"><Bot size={17} /><span className="text-sm font-semibold">AI Coder</span><span className="ml-auto rounded-md border border-neutral-800 px-2 py-1 text-[10px] uppercase tracking-widest text-neutral-600">Live</span></div>
          <div className="flex-1 space-y-4 overflow-auto p-4">{messages.length === 0 ? <div className="rounded-xl border border-dashed border-neutral-800 p-5"><div className="mb-2 text-sm font-medium">Ready to code</div><div className="text-xs leading-5 text-neutral-500">Describe a change, then use Code, Debug, Test, Review, or Auto against the selected file.</div></div> : messages.map((message, index) => <div key={`${message.role}-${index}`} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3"><div className="mb-2 text-[10px] uppercase tracking-widest text-neutral-600">{message.role}</div><pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-neutral-200">{message.content}</pre></div>)}</div>
          <div className="border-t border-neutral-800 p-4"><div className="rounded-xl border border-neutral-800 bg-neutral-900"><textarea value={prompt} onChange={event => setPrompt(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendPrompt() } }} placeholder="Tell the Coding Agent what to build..." className="h-24 w-full resize-none bg-transparent p-3 text-sm outline-none placeholder:text-neutral-600" /><div className="flex items-center justify-between border-t border-neutral-800 px-3 py-2"><span className="text-[11px] text-neutral-600">Enter to send · Shift+Enter for newline</span><button onClick={() => void sendPrompt()} disabled={loading || !prompt.trim()} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-40"><Send size={14} />{loading ? "Working..." : "Send"}</button></div></div></div>
        </aside>
      </section>
    </main>
  )
}
