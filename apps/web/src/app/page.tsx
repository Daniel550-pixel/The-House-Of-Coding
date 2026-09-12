"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FolderOpen,
  Play,
  RefreshCw,
  Save,
  Search,
  Send,
  Terminal,
  X,
  Volume2,
  VolumeX,
  Zap,
  Code2,
  Layers,
  Radio
} from "lucide-react"
import { AutonomousControls, type AgentAction } from "../components/autonomous-controls"
import { SymbolOutline } from "../components/symbol-outline"
import { FuturisticHud, type HudTelemetry } from "../components/futuristic-hud"
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

type SystemView = "radar" | "code" | "agents" | "dual"

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

function diffLines(before: string, after: string) {
  const oldLines = before.split("\n")
  const newLines = after.split("\n")
  const max = Math.max(oldLines.length, newLines.length)
  const rows: Array<{ kind: "same" | "removed" | "added"; oldLine: number | null; newLine: number | null; text: string }> = []

  for (let index = 0; index < max; index += 1) {
    const oldLine = oldLines[index]
    const newLine = newLines[index]

    if (oldLine === newLine) {
      rows.push({ kind: "same", oldLine: index + 1, newLine: index + 1, text: oldLine ?? "" })
    } else {
      if (oldLine !== undefined) {
        rows.push({ kind: "removed", oldLine: index + 1, newLine: null, text: oldLine })
      }
      if (newLine !== undefined) {
        rows.push({ kind: "added", oldLine: null, newLine: index + 1, text: newLine })
      }
    }
  }

  return rows
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
          className="flex w-full items-center gap-1.5 py-1 pr-2 text-left text-xs text-cyan-400/70 hover:bg-cyan-950/40 hover:text-cyan-200"
          style={{ paddingLeft: `${8 + depth * 10}px` }}
        >
          {expanded ? <ChevronDown size={13} className="text-cyan-400" /> : <ChevronRight size={13} className="text-cyan-400" />}
          <FolderOpen size={14} className="text-cyan-300" />
          <span className="truncate font-mono">{node.name}</span>
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
      className={`flex w-full items-center gap-2 py-1 pr-2 text-left text-xs transition ${
        isSelected
          ? "border-l-2 border-cyan-400 bg-cyan-950/70 text-white font-bold text-glow"
          : isOpen
            ? "text-cyan-300 bg-cyan-950/30"
            : "text-cyan-500/70 hover:bg-cyan-950/40 hover:text-cyan-200"
      }`}
      style={{ paddingLeft: `${20 + depth * 10}px` }}
      title={node.path}
    >
      <FileCode2 size={13} className={isSelected ? "text-cyan-300" : "text-cyan-500"} />
      <span className="truncate font-mono">{node.name}</span>
      {isOpen && <span className="ml-auto mr-1 h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />}
    </button>
  )
}

export default function Home() {
  const [systemView, setSystemView] = useState<SystemView>("radar")
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [languages, setLanguages] = useState<LanguageRuntime[]>([])
  const [selectedFile, setSelectedFile] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState("typescript")
  const [selection, setSelection] = useState({ start: 0, end: 0 })
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [prompt, setPrompt] = useState("")
  const [search, setSearch] = useState("")
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState("")
  const [globalResults, setGlobalResults] = useState<SearchResult[]>([])
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
  const [goToLineOpen, setGoToLineOpen] = useState(false)
  const [goToLineValue, setGoToLineValue] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [proposal, setProposal] = useState<{ changes: Array<{ path: string; content: string }>; action: AgentAction; summary: string } | null>(null)
  const [rollback, setRollback] = useState<{ changes: Array<{ path: string; content: string }>; action: AgentAction; summary: string } | null>(null)
  const [applyingProposal, setApplyingProposal] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [output, setOutput] = useState("")
  const [outputKind, setOutputKind] = useState<"execution" | "agent" | "system">("system")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState("CYBER-OS ONLINE")
  const [extraHudLogs, setExtraHudLogs] = useState<string[]>([])

  // Live Telemetry simulation
  const [sysTemp, setSysTemp] = useState("38.4°C")
  const [coreLoad, setCoreLoad] = useState("42%")
  const [linkFreq, setLinkFreq] = useState("142.80 MHz")
  const [latency, setLatency] = useState("1.2ms")

  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const goToLineRef = useRef<HTMLInputElement | null>(null)
  const globalSearchRef = useRef<HTMLInputElement | null>(null)
  const openingFilesRef = useRef(new Set<string>())
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Web Audio Synth for clicks
  const playBeep = useCallback((freq = 880, type: OscillatorType = "sine", duration = 0.05) => {
    if (!soundEnabled) return
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioCtxRef.current = new AudioContextClass()
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume()
      }
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      // Audio context may require user interaction
    }
  }, [soundEnabled])

  // Periodic Telemetry Fluctuations
  useEffect(() => {
    const interval = setInterval(() => {
      setSysTemp(`${(38.0 + Math.sin(Date.now() / 3000) * 0.9).toFixed(1)}°C`)
      setCoreLoad(`${Math.round(40 + Math.sin(Date.now() / 2000) * 8)}%`)
      setLinkFreq(`${(142.75 + Math.sin(Date.now() / 4500) * 0.15).toFixed(2)} MHz`)
      setLatency(`${(1.1 + Math.random() * 0.3).toFixed(1)}ms`)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

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
  const selectedCode = selection.end > selection.start ? code.slice(selection.start, selection.end) : ""
  const numbers = useMemo(() => lineNumbers(code), [code])
  const diagnostics = useMemo(() => parseDiagnostics(output), [output])

  useEffect(() => {
    if (openTabs.length === uniqueTabs.length) return
    setOpenTabs(uniqueTabs)
  }, [openTabs.length, uniqueTabs])

  useEffect(() => setSelection({ start: 0, end: 0 }), [selectedFile])

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
        playBeep(920, "sine", 0.06)
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
        event.preventDefault()
        setGoToLineOpen(true)
        playBeep(850, "sine", 0.05)
        return
      }

      if (!editing && (event.ctrlKey || event.metaKey) && event.key === "PageDown" && uniqueTabs.length > 1) {
        event.preventDefault()
        const currentIndex = Math.max(uniqueTabs.findIndex(tab => tab.path === selectedFile), 0)
        const nextTab = uniqueTabs[(currentIndex + 1) % uniqueTabs.length]
        setSelectedFile(nextTab.path)
        setSelectedLanguage(detectLanguage(nextTab.path, languages))
        playBeep(700, "sine", 0.04)
        return
      }

      if (!editing && (event.ctrlKey || event.metaKey) && event.key === "PageUp" && uniqueTabs.length > 1) {
        event.preventDefault()
        const currentIndex = Math.max(uniqueTabs.findIndex(tab => tab.path === selectedFile), 0)
        const nextTab = uniqueTabs[(currentIndex - 1 + uniqueTabs.length) % uniqueTabs.length]
        setSelectedFile(nextTab.path)
        setSelectedLanguage(detectLanguage(nextTab.path, languages))
        playBeep(700, "sine", 0.04)
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [languages, selectedFile, uniqueTabs, playBeep])

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

  const goToLine = useCallback(() => {
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
    playBeep(850, "sine", 0.05)
  }, [goToLineValue, selectedFile, numbers.length, code, playBeep])

  const refreshWorkspace = useCallback(async () => {
    setStatus("Scanning workspace...")
    playBeep(640, "sine", 0.04)
    try {
      const [projectData, fileData, languageData] = await Promise.all([getProjects(), getProjectFiles(PROJECT_ID), getLanguages()])
      setProject(projectData.projects[0] ?? null)
      setFiles(fileData.files)
      setLanguages(languageData.languages)
      setStatus("CYBER-OS ONLINE")
      setExtraHudLogs(prev => [...prev.slice(-20), `[WORKSPACE] REFRESHED: ${fileData.files.length} FILES DETECTED`])
    } catch (error) {
      setStatus(formatError(error, "Workspace link offline"))
    }
  }, [playBeep])

  async function openFile(path: string, targetLine?: number, targetColumn?: number) {
    if (openingFilesRef.current.has(path)) return

    playBeep(780, "sine", 0.04)
    const existing = uniqueTabs.find(tab => tab.path === path)
    if (existing) {
      setSelectedFile(path)
      setSelectedLanguage(detectLanguage(path, languages))
      setOutput("")
      setExtraHudLogs(prev => [...prev.slice(-20), `[EDITOR] ACTIVE TAB: ${fileName(path)}`])
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
    setStatus(`Loading ${fileName(path)}...`)
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
      setStatus("CYBER-OS ONLINE")
      setExtraHudLogs(prev => [...prev.slice(-20), `[FILE_SYS] LOADED: ${path}`])
    } catch (error) {
      setStatus(formatError(error, `Failed to read ${path}`))
    } finally {
      openingFilesRef.current.delete(path)
    }
  }

  function updateCode(value: string) {
    setOpenTabs(current => current.map(tab => (tab.path === selectedFile ? { ...tab, content: value } : tab)))
  }

  async function saveTab(targetPath = selectedFile) {
    const tab = uniqueTabs.find(item => item.path === targetPath)
    if (!tab || saving) return

    setSaving(true)
    setStatus(`Writing ${fileName(targetPath)}...`)
    playBeep(1050, "sine", 0.08)
    try {
      await saveProjectFile({ projectId: PROJECT_ID, path: tab.path, content: tab.content })
      setOpenTabs(current => current.map(item => (item.path === targetPath ? { ...item, savedContent: item.content } : item)))
      setStatus("CYBER-OS ONLINE")
      setExtraHudLogs(prev => [...prev.slice(-20), `[DISK_IO] COMMITTED: ${targetPath}`])
    } catch (error) {
      setStatus(formatError(error, `Save failed for ${targetPath}`))
    } finally {
      setSaving(false)
    }
  }

  async function applyProposal() {
    if (!proposal || applyingProposal) return
    setApplyingProposal(true)
    playBeep(1200, "triangle", 0.12)
    try {
      const rollbackChanges = proposal.changes.map(change => ({
        path: change.path,
        content: uniqueTabs.find(tab => tab.path === change.path)?.savedContent ?? ""
      }))

      for (const change of proposal.changes) {
        await saveProjectFile({ projectId: PROJECT_ID, path: change.path, content: change.content })
      }

      setOpenTabs(current =>
        current.map(tab => {
          const match = proposal.changes.find(c => c.path === tab.path)
          return match ? { ...tab, content: match.content, savedContent: match.content } : tab
        })
      )

      setRollback({ changes: rollbackChanges, action: proposal.action, summary: proposal.summary })
      setProposal(null)
      await refreshWorkspace()
      if (selectedFile) await openFile(selectedFile)
      setStatus("Changes verified and committed")
      setExtraHudLogs(prev => [...prev.slice(-20), `[AI_PROPOSAL] ACCEPTED & APPLIED: ${proposal.changes.length} FILES`])
    } catch (error) {
      setStatus(formatError(error, "Proposal application failed"))
    } finally {
      setApplyingProposal(false)
    }
  }

  function rejectProposal() {
    playBeep(450, "sine", 0.06)
    setProposal(null)
    setStatus("Proposal rejected")
    setExtraHudLogs(prev => [...prev.slice(-20), "[AI_PROPOSAL] REJECTED BY USER"])
  }

  async function applyRollback() {
    if (!rollback || rollingBack) return
    setRollingBack(true)
    playBeep(520, "sine", 0.08)
    try {
      for (const change of rollback.changes) {
        await saveProjectFile({ projectId: PROJECT_ID, path: change.path, content: change.content })
      }
      setOpenTabs(current =>
        current.map(tab => {
          const match = rollback.changes.find(c => c.path === tab.path)
          return match ? { ...tab, content: match.content, savedContent: match.content } : tab
        })
      )
      setRollback(null)
      await refreshWorkspace()
      if (selectedFile) await openFile(selectedFile)
      setStatus("Rollback completed")
      setExtraHudLogs(prev => [...prev.slice(-20), "[ROLLBACK] STATE RESTORED"])
    } catch (error) {
      setStatus(formatError(error, "Rollback failed"))
    } finally {
      setRollingBack(false)
    }
  }

  function closeTab(path: string) {
    playBeep(600, "sine", 0.04)
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
    setOutput("Compiling and executing target in secure sandbox...\n")
    setOutputKind("execution")
    playBeep(980, "triangle", 0.1)
    setExtraHudLogs(prev => [...prev.slice(-20), `[EXECUTE] DISPATCH: ${selectedFile}`])

    try {
      await saveTab(selectedFile)
      const result = await executeFile({ language: selectedLanguage, filePath: selectedFile })
      setOutput([
        `STATUS: ${result.result.success ? "SUCCESS" : "FAILED"}`,
        `Command: ${result.result.command}`,
        `Exit code: ${result.result.exitCode}`,
        `Duration: ${result.result.durationMs} ms`,
        "",
        "STDOUT",
        result.result.stdout || "(none)",
        "",
        "STDERR",
        result.result.stderr || "(none)"
      ].join("\n"))
      setStatus(result.result.success ? "Execution successful" : "Execution failed")
      setExtraHudLogs(prev => [
        ...prev.slice(-20),
        `[EXECUTE] RESULT: ${result.result.success ? "SUCCESS (0)" : "NON-ZERO EXIT"}`
      ])
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
    playBeep(1100, "sine", 0.08)
    setExtraHudLogs(prev => [...prev.slice(-20), `[AGENT_DISPATCH] PROMPT: "${instruction.slice(0, 30)}..."`])

    try {
      const result = await generateCode({
        instruction: `${instruction}\n\nThe currently selected file is ${selectedFile || "none"}. Preserve unrelated files unless a change is required.`,
        language: selectedLanguage,
        projectId: PROJECT_ID,
        apply: true
      })
      const changedFiles = result.result.files?.length ? `\n\nChanged files:\n${result.result.files.join("\n")}` : ""
      setMessages(current => [
        ...current,
        { role: "assistant", content: `${result.result.response ?? "No response returned."}${changedFiles}` }
      ])
      await refreshWorkspace()
      if (selectedFile) await openFile(selectedFile)
      setOutputKind("agent")
      setOutput(result.result.response ?? "Coding Agent completed.")
      setExtraHudLogs(prev => [...prev.slice(-20), "[AGENT_DISPATCH] COMPLETED"])
    } catch (error) {
      setMessages(current => [...current, { role: "assistant", content: formatError(error, "Unable to reach the Coding Agent.") }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refreshWorkspace() }, [refreshWorkspace])

  useEffect(() => {
    if (!selectedFile && files.some(file => file.path === DEFAULT_FILE)) void openFile(DEFAULT_FILE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, selectedFile])

  const telemetryData: HudTelemetry = {
    sysTemp,
    coreLoad,
    linkFreq,
    latency,
    workspaceFilesCount: files.length,
    activeProjectName: project?.name ?? "HouseOfCoding",
    recentLogs: extraHudLogs
  }

  return (
    <main className="relative flex flex-col h-screen w-screen overflow-hidden bg-[#030810] text-[#00f3ff] font-tech-mono">
      {/* SCANLINE OVERLAY */}
      <div className="absolute inset-0 scanline-bg pointer-events-none z-40 opacity-50" />

      {/* SYSTEM HEADER BAR */}
      <header className="relative z-30 flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/30 bg-[#03101a]/95 px-4 py-2 backdrop-blur-md">
        {/* Brand & Beacon */}
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-500" />
          </span>
          <div>
            <div className="font-orbitron text-xs sm:text-sm font-bold tracking-widest text-glow flex items-center gap-2">
              <span>CYBER-OS // HOUSE OF CODING</span>
              <span className="text-[10px] text-white/50 font-normal">v4.9.2</span>
            </div>
            <div className="text-[9px] text-cyan-400/60 tracking-wider">
              STATUS: <span className="text-emerald-400 font-bold">{status}</span>
            </div>
          </div>
        </div>

        {/* SYSTEM VIEW SELECTOR (RADAR / CODE / AGENTS / DUAL) */}
        <div className="flex items-center border border-cyan-500/30 bg-[#020b14] p-0.5 box-glow">
          <button
            onClick={() => {
              setSystemView("radar")
              playBeep(900, "sine", 0.05)
            }}
            className={`flex items-center gap-1.5 px-3 py-1 font-orbitron text-[10px] tracking-wider transition ${
              systemView === "radar"
                ? "border border-cyan-400 bg-cyan-500/30 text-white font-bold box-glow"
                : "text-cyan-400/60 hover:text-cyan-200"
            }`}
          >
            <Radio size={12} className={systemView === "radar" ? "animate-pulse text-cyan-300" : ""} />
            RADAR HUD
          </button>
          <button
            onClick={() => {
              setSystemView("code")
              playBeep(900, "sine", 0.05)
            }}
            className={`flex items-center gap-1.5 px-3 py-1 font-orbitron text-[10px] tracking-wider transition ${
              systemView === "code"
                ? "border border-cyan-400 bg-cyan-500/30 text-white font-bold box-glow"
                : "text-cyan-400/60 hover:text-cyan-200"
            }`}
          >
            <Code2 size={12} className={systemView === "code" ? "text-cyan-300" : ""} />
            CODE STUDIO
          </button>
          <button
            onClick={() => {
              setSystemView("agents")
              playBeep(900, "sine", 0.05)
            }}
            className={`flex items-center gap-1.5 px-3 py-1 font-orbitron text-[10px] tracking-wider transition ${
              systemView === "agents"
                ? "border border-cyan-400 bg-cyan-500/30 text-white font-bold box-glow"
                : "text-cyan-400/60 hover:text-cyan-200"
            }`}
          >
            <Bot size={12} className={systemView === "agents" ? "text-cyan-300" : ""} />
            AI AGENTS
          </button>
          <button
            onClick={() => {
              setSystemView("dual")
              playBeep(900, "sine", 0.05)
            }}
            className={`flex items-center gap-1.5 px-3 py-1 font-orbitron text-[10px] tracking-wider transition ${
              systemView === "dual"
                ? "border border-cyan-400 bg-cyan-500/30 text-white font-bold box-glow"
                : "text-cyan-400/60 hover:text-cyan-200"
            }`}
          >
            <Layers size={12} className={systemView === "dual" ? "text-cyan-300" : ""} />
            DUAL COCKPIT
          </button>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex items-center gap-2">
          {/* Audio Toggle */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled)
              playBeep(soundEnabled ? 400 : 900, "sine", 0.05)
            }}
            className={`flex items-center gap-1 border px-2 py-1 text-[10px] font-orbitron transition ${
              soundEnabled
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 box-glow"
                : "border-cyan-500/30 bg-transparent text-cyan-500/40 hover:text-cyan-300"
            }`}
            title={soundEnabled ? "Audio Synthesizer Enabled" : "Muted"}
          >
            {soundEnabled ? <Volume2 size={12} className="animate-pulse" /> : <VolumeX size={12} />}
            <span className="hidden sm:inline">{soundEnabled ? "SFX ON" : "MUTED"}</span>
          </button>

          {/* Quick Search */}
          <button
            onClick={() => setGlobalSearchOpen(true)}
            className="flex items-center gap-1.5 border border-cyan-500/30 bg-cyan-950/40 px-2 py-1 text-[10px] font-orbitron text-cyan-300 hover:border-cyan-400 transition"
            title="Global Workspace Search (Ctrl+P)"
          >
            <Search size={12} />
            <span className="hidden sm:inline">FIND (CTRL+P)</span>
          </button>

          {/* Run file */}
          <button
            onClick={() => void runCurrentFile()}
            disabled={running || !selectedFile}
            className="flex items-center gap-1.5 border border-cyan-400 bg-cyan-500/30 px-3 py-1 text-[10px] font-orbitron font-bold text-white hover:bg-cyan-500/40 disabled:opacity-40 transition box-glow"
          >
            <Play size={12} className={running ? "animate-spin" : ""} />
            <span>{running ? "EXECUTING..." : "EXECUTE"}</span>
          </button>

          {/* Save file */}
          <button
            onClick={() => void saveTab()}
            disabled={saving || !dirty}
            className={`border px-2.5 py-1 text-[10px] font-orbitron transition ${
              dirty
                ? "border-amber-400 bg-amber-500/20 text-amber-300 animate-pulse"
                : "border-cyan-500/30 bg-transparent text-cyan-400/50 hover:text-cyan-300 disabled:opacity-40"
            }`}
            title={dirty ? "Unsaved changes" : "Saved"}
          >
            <Save size={12} />
          </button>

          {/* Refresh workspace */}
          <button
            onClick={() => void refreshWorkspace()}
            className="border border-cyan-500/30 bg-cyan-950/40 p-1 text-cyan-400 hover:text-cyan-200 transition"
            title="Rescan project"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </header>

      {/* SEARCH MODAL */}
      {globalSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm px-4 pt-[10vh]" onMouseDown={() => setGlobalSearchOpen(false)}>
          <div className="hud-panel w-full max-w-2xl overflow-hidden box-glow" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-cyan-500/30 bg-[#020b14] px-4 py-3">
              <Search size={16} className="text-cyan-400" />
              <input
                ref={globalSearchRef}
                value={globalQuery}
                onChange={e => setGlobalQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Escape") setGlobalSearchOpen(false) }}
                placeholder="Search across all files in cyber workspace..."
                className="min-w-0 flex-1 bg-transparent text-sm text-cyan-200 outline-none placeholder:text-cyan-500/40 font-mono"
              />
              <kbd className="border border-cyan-500/40 bg-cyan-950/60 px-1.5 py-0.5 text-[9px] text-cyan-300 font-mono">ESC TO EXIT</kbd>
              <button onClick={() => setGlobalSearchOpen(false)} className="text-cyan-400/70 hover:text-cyan-200"><X size={15} /></button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-1 bg-[#030e18]">
              {globalQuery.trim().length < 2 ? (
                <div className="px-4 py-8 text-center text-xs text-cyan-500/60 font-mono">ENTER AT LEAST 2 CHARACTERS TO SCAN FILES.</div>
              ) : globalSearchLoading ? (
                <div className="px-4 py-8 text-center text-xs text-cyan-400 font-mono animate-pulse">SEARCHING WORKSPACE...</div>
              ) : globalResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-cyan-500/60 font-mono">NO MATCHES DISCOVERED.</div>
              ) : (
                <div className="divide-y divide-cyan-500/15">
                  {globalResults.map((result, index) => (
                    <button
                      key={`${result.path}:${result.line}:${result.column}:${index}`}
                      onClick={() => {
                        setGlobalSearchOpen(false)
                        void openFile(result.path, result.line, result.column)
                      }}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-cyan-500/10 transition"
                    >
                      <FileCode2 size={14} className="mt-0.5 shrink-0 text-cyan-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-cyan-300">
                          <span className="truncate font-bold">{result.path}</span>
                          <span className="text-[10px] text-cyan-500/70">{result.line}:{result.column}</span>
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-cyan-400/70">{result.text}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GO TO LINE MODAL */}
      {goToLineOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm px-4 pt-[15vh]" onMouseDown={() => setGoToLineOpen(false)}>
          <div className="hud-panel w-full max-w-md overflow-hidden box-glow" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-cyan-500/30 bg-[#020b14] px-4 py-2.5 text-xs font-orbitron font-bold text-glow">
              <span>GO TO LINE NUMBER</span>
              <button onClick={() => setGoToLineOpen(false)} className="text-cyan-400 hover:text-white"><X size={14} /></button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault()
                goToLine()
              }}
              className="p-4 bg-[#030e18] flex gap-2"
            >
              <input
                ref={goToLineRef}
                type="number"
                min={1}
                max={numbers.length}
                value={goToLineValue}
                onChange={e => setGoToLineValue(e.target.value)}
                placeholder={`Line 1-${numbers.length}...`}
                className="flex-1 bg-cyan-950/40 border border-cyan-500/30 px-3 py-2 text-xs font-mono text-cyan-200 outline-none"
              />
              <button
                type="submit"
                className="border border-cyan-400 bg-cyan-500/30 px-4 py-2 text-xs font-orbitron font-bold text-white box-glow"
              >
                JUMP
              </button>
            </form>
          </div>
        </div>
      )}

      {/* AI CHANGE PROPOSAL MODAL */}
      {proposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4" onMouseDown={rejectProposal}>
          <div className="hud-panel flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden box-glow" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-cyan-500/30 bg-[#020b14] px-5 py-3">
              <div>
                <div className="font-orbitron text-xs sm:text-sm font-bold tracking-widest text-glow">
                  AI CHANGE PROPOSAL // {proposal.action.toUpperCase()}
                </div>
                <div className="text-[10px] text-cyan-400/70 font-mono">
                  {proposal.changes.length} TARGET FILE(S) MODIFIED
                </div>
              </div>
              <button onClick={rejectProposal} disabled={applyingProposal} className="text-cyan-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-[#030e18] space-y-4">
              <div className="border border-cyan-500/30 bg-cyan-950/40 p-3 text-xs text-cyan-200 font-mono">
                {proposal.summary}
              </div>

              {proposal.changes.map(change => {
                const current = uniqueTabs.find(tab => tab.path === change.path)?.content ?? ""
                const rows = diffLines(current, change.content)

                return (
                  <div key={change.path} className="border border-cyan-500/30 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-cyan-500/30 bg-cyan-950/60 px-3 py-1.5 text-xs text-cyan-300 font-mono">
                      <span>{change.path}</span>
                      <span className="text-[10px] text-cyan-400/60">
                        {current.split("\n").length} → {change.content.split("\n").length} LINES
                      </span>
                    </div>
                    <div className="overflow-auto bg-[#010810] font-mono text-[10px] leading-5 max-h-64">
                      {rows.map((row, index) => (
                        <div
                          key={`${change.path}:${index}`}
                          className={
                            row.kind === "removed"
                              ? "grid grid-cols-[44px_44px_1fr] bg-rose-950/40 text-rose-300"
                              : row.kind === "added"
                              ? "grid grid-cols-[44px_44px_1fr] bg-emerald-950/40 text-emerald-300"
                              : "grid grid-cols-[44px_44px_1fr] text-cyan-500/60"
                          }
                        >
                          <span className="border-r border-cyan-500/15 px-2 text-right">{row.oldLine ?? ""}</span>
                          <span className="border-r border-cyan-500/15 px-2 text-right">{row.newLine ?? ""}</span>
                          <span className="whitespace-pre px-3">{row.kind === "removed" ? "-" : row.kind === "added" ? "+" : " "} {row.text || " "}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-cyan-500/30 bg-[#020b14] px-5 py-3">
              <button
                onClick={rejectProposal}
                disabled={applyingProposal}
                className="border border-cyan-500/30 px-4 py-1.5 font-orbitron text-xs text-cyan-400 hover:bg-cyan-950/50"
              >
                DISCARD
              </button>
              <button
                onClick={() => void applyProposal()}
                disabled={applyingProposal}
                className="border border-cyan-400 bg-cyan-500/30 px-5 py-1.5 font-orbitron text-xs font-bold text-white hover:bg-cyan-500/40 box-glow"
              >
                {applyingProposal ? "APPLYING..." : "ACCEPT & COMMIT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROLLBACK FLOATING NOTIFICATION */}
      {rollback && (
        <div className="hud-panel fixed bottom-4 right-4 z-40 flex items-center gap-3 p-3 box-glow border-cyan-400">
          <div>
            <div className="text-xs font-orbitron font-bold text-white">AI CHANGES APPLIED</div>
            <div className="text-[10px] text-cyan-400/70 font-mono">{rollback.changes.length} FILE(S) MODIFIED</div>
          </div>
          <button
            onClick={() => void applyRollback()}
            disabled={rollingBack}
            className="border border-cyan-400 bg-cyan-500/30 px-3 py-1 text-xs font-orbitron font-bold text-white hover:bg-cyan-500/40 box-glow"
          >
            {rollingBack ? "REVERTING..." : "ROLLBACK"}
          </button>
          <button onClick={() => setRollback(null)} className="text-cyan-400/60 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* MAIN VIEW CONTENT CONTAINER */}
      <div className="relative flex-1 overflow-hidden z-10">
        {/* ================================================================== */}
        {/* 1. RADAR HUD FULL COCKPIT VIEW                                     */}
        {/* ================================================================== */}
        {systemView === "radar" && (
          <div className="h-full w-full overflow-hidden">
            <FuturisticHud
              telemetry={telemetryData}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
              extraLogs={extraHudLogs}
            />
          </div>
        )}

        {/* ================================================================== */}
        {/* 2. DUAL COCKPIT SPLIT VIEW                                         */}
        {/* ================================================================== */}
        {systemView === "dual" && (
          <div className="grid h-full grid-cols-1 lg:grid-cols-2 gap-2 p-2 overflow-hidden">
            {/* Left Half: HUD Cockpit */}
            <div className="hud-panel h-full overflow-hidden flex flex-col box-glow">
              <div className="border-b border-cyan-500/30 bg-[#020b14] px-3 py-1.5 flex items-center justify-between font-orbitron text-xs font-bold text-glow">
                <span>RADAR TELEMETRY MATRIX</span>
                <span className="text-[9px] text-cyan-400/60 font-mono">ACTIVE SCANNER</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <FuturisticHud
                  telemetry={telemetryData}
                  soundEnabled={soundEnabled}
                  onToggleSound={() => setSoundEnabled(!soundEnabled)}
                  extraLogs={extraHudLogs}
                />
              </div>
            </div>

            {/* Right Half: Code Studio & Agent Workspace */}
            <div className="hud-panel h-full overflow-hidden flex flex-col box-glow">
              {/* Agent Bar at top */}
              <div className="border-b border-cyan-500/30 p-2 bg-[#020b14]">
                <AutonomousControls
                  language={selectedLanguage}
                  filePath={selectedFile}
                  code={code}
                  instruction={prompt}
                  selection={selectedCode}
                  onProposal={p => setProposal(p)}
                  onOutput={val => {
                    setOutputKind("agent")
                    setOutput(val)
                  }}
                  onFilesChanged={() => {
                    void refreshWorkspace()
                    if (selectedFile) void openFile(selectedFile)
                  }}
                />
              </div>

              {/* Split into Tree + Editor */}
              <div className="grid flex-1 grid-cols-[200px_minmax(0,1fr)] overflow-hidden">
                {/* Explorer mini-sidebar */}
                <div className="border-r border-cyan-500/20 bg-[#020d17]/80 overflow-y-auto p-2 font-mono text-xs">
                  <div className="text-[10px] text-cyan-400/60 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                    <FolderOpen size={12} />
                    WORKSPACE FILES
                  </div>
                  {visibleTree.map(node => (
                    <AgentTreeNode
                      key={node.path}
                      node={node}
                      depth={0}
                      selectedFile={selectedFile}
                      openTabs={uniqueTabs}
                      onOpen={path => void openFile(path)}
                    />
                  ))}
                </div>

                {/* Code Editor */}
                <div className="flex flex-col h-full overflow-hidden bg-[#020a13]">
                  {/* Tabs */}
                  <div className="flex items-center overflow-x-auto border-b border-cyan-500/20 bg-[#020b14] h-8 px-1">
                    {uniqueTabs.map(tab => {
                      const active = tab.path === selectedFile
                      return (
                        <div
                          key={tab.path}
                          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono border-r border-cyan-500/20 cursor-pointer ${
                            active ? "bg-cyan-950/80 text-white font-bold border-t-2 border-t-cyan-400" : "text-cyan-500/60 hover:text-cyan-300"
                          }`}
                          onClick={() => {
                            setSelectedFile(tab.path)
                            setSelectedLanguage(detectLanguage(tab.path, languages))
                          }}
                        >
                          <FileCode2 size={11} className={active ? "text-cyan-300" : ""} />
                          <span className="truncate max-w-[110px]">{fileName(tab.path)}</span>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              closeTab(tab.path)
                            }}
                            className="hover:text-white ml-1"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {/* Textarea */}
                  <div className="relative flex-1 grid grid-cols-[40px_minmax(0,1fr)] overflow-hidden">
                    <div className="cyber-line-numbers select-none overflow-hidden border-r border-cyan-500/20 bg-[#010810] px-1 pt-3 text-right font-mono text-xs leading-7">
                      {numbers.map(n => <div key={n}>{n}</div>)}
                    </div>
                    <textarea
                      ref={editorRef}
                      value={code}
                      onChange={e => updateCode(e.target.value)}
                      spellCheck={false}
                      className="cyber-editor-textarea h-full w-full resize-none overflow-auto bg-transparent px-3 py-3 font-mono text-xs leading-7 outline-none"
                    />
                  </div>

                  {/* Diagnostics bar */}
                  <div className="h-28 border-t border-cyan-500/20 bg-[#010810] p-2 overflow-y-auto font-mono text-xs text-cyan-300/80">
                    <div className="text-[10px] text-cyan-400/60 uppercase mb-1">TERMINAL & AGENT OUTPUT</div>
                    <pre className="whitespace-pre-wrap">{output || "System operational. No active errors."}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* 3. CODE STUDIO FULL VIEW                                           */}
        {/* ================================================================== */}
        {systemView === "code" && (
          <div className="grid h-full grid-cols-[240px_minmax(0,1fr)_340px] overflow-hidden p-2 gap-2">
            {/* Left Explorer Panel */}
            <aside className="hud-panel flex flex-col overflow-hidden box-glow">
              <div className="flex items-center justify-between border-b border-cyan-500/30 bg-[#020b14] px-3 py-2 font-orbitron text-xs font-bold text-glow">
                <span className="flex items-center gap-1.5">
                  <FolderOpen size={13} />
                  EXPLORER
                </span>
                <span className="text-[10px] text-cyan-400/60 font-mono">{files.length} ASSETS</span>
              </div>

              {/* Search input */}
              <div className="p-2 border-b border-cyan-500/20">
                <div className="flex items-center gap-2 border border-cyan-500/30 bg-cyan-950/40 px-2 py-1">
                  <Search size={12} className="text-cyan-400/60" />
                  <input
                    id="file-search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Filter files..."
                    className="min-w-0 flex-1 bg-transparent text-xs text-cyan-200 outline-none placeholder:text-cyan-500/40 font-mono"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="text-cyan-400 hover:text-white">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Symbols & Tree */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                <SymbolOutline
                  filePath={selectedFile}
                  onJump={line => {
                    const indexAtLine = lineStartIndex(code, Math.min(Math.max(line, 1), numbers.length))
                    editorRef.current?.focus()
                    editorRef.current?.setSelectionRange(indexAtLine, indexAtLine)
                    setStatus(`Line ${Math.min(Math.max(line, 1), numbers.length)}`)
                  }}
                />
                <div className="text-[10px] text-cyan-400/60 uppercase font-mono tracking-wider px-1">FILES</div>
                {visibleTree.map(node => (
                  <AgentTreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedFile={selectedFile}
                    openTabs={uniqueTabs}
                    onOpen={path => void openFile(path)}
                  />
                ))}
              </div>
            </aside>

            {/* Center Editor Panel */}
            <section className="hud-panel flex flex-col overflow-hidden box-glow">
              {/* File Info Bar */}
              <div className="flex items-center justify-between border-b border-cyan-500/30 bg-[#020b14] px-4 py-2 text-xs font-mono">
                <div className="flex items-center gap-2 text-cyan-200 font-bold">
                  <FileCode2 size={14} className="text-cyan-400" />
                  <span>{selectedFile || "No target selected"}</span>
                  <span className="text-[10px] text-cyan-500/60 font-normal">[{selectedLanguage}]</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold ${dirty ? "text-amber-400 animate-pulse" : "text-emerald-400"}`}>
                    {dirty ? "MODIFIED // UNSAVED" : "SYNCHRONIZED"}
                  </span>
                </div>
              </div>

              {/* Tabs strip */}
              <div className="flex items-center overflow-x-auto border-b border-cyan-500/20 bg-[#010811] h-8 px-1">
                {uniqueTabs.map(tab => {
                  const active = tab.path === selectedFile
                  const isDirty = tab.content !== tab.savedContent
                  return (
                    <div
                      key={tab.path}
                      className={`group flex items-center gap-2 px-3 py-1 text-xs font-mono border-r border-cyan-500/20 cursor-pointer ${
                        active
                          ? "bg-cyan-950/80 text-white font-bold border-t-2 border-t-cyan-400 text-glow"
                          : "text-cyan-500/60 hover:text-cyan-300"
                      }`}
                      onClick={() => {
                        setSelectedFile(tab.path)
                        setSelectedLanguage(detectLanguage(tab.path, languages))
                      }}
                    >
                      <FileCode2 size={11} className={active ? "text-cyan-300" : ""} />
                      <span className="truncate max-w-[140px]">{fileName(tab.path)}</span>
                      {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          closeTab(tab.path)
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-white"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Main Textarea with Line Numbers */}
              <div className="relative flex-1 grid grid-cols-[48px_minmax(0,1fr)] overflow-hidden bg-[#020a13]">
                <div className="cyber-line-numbers select-none overflow-hidden border-r border-cyan-500/20 bg-[#010810] px-2 pt-3 text-right font-mono text-xs leading-7">
                  {numbers.map(n => <div key={n}>{n}</div>)}
                </div>
                <textarea
                  ref={editorRef}
                  value={code}
                  onChange={e => updateCode(e.target.value)}
                  onSelect={e => setSelection({ start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })}
                  onKeyUp={e => setSelection({ start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })}
                  onClick={e => setSelection({ start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd })}
                  onKeyDown={e => {
                    if (e.key === "Tab") {
                      e.preventDefault()
                      const start = e.currentTarget.selectionStart
                      const end = e.currentTarget.selectionEnd
                      updateCode(`${code.slice(0, start)}  ${code.slice(end)}`)
                      requestAnimationFrame(() => {
                        e.currentTarget.selectionStart = start + 2
                        e.currentTarget.selectionEnd = start + 2
                      })
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                      e.preventDefault()
                      void saveTab()
                    }
                  }}
                  spellCheck={false}
                  wrap="off"
                  disabled={!selectedFile}
                  className="cyber-editor-textarea h-full w-full resize-none overflow-auto bg-transparent px-4 py-3 font-mono text-xs leading-7 outline-none"
                />
              </div>

              {/* Bottom Output Terminal */}
              <div className="h-44 border-t border-cyan-500/30 bg-[#010912] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-cyan-500/20 bg-[#020b14] px-4 py-1.5 text-xs font-mono">
                  <div className="flex items-center gap-3 text-cyan-300 font-bold">
                    <div className="flex items-center gap-1.5">
                      <Terminal size={13} />
                      <span>{outputKind === "execution" ? "EXECUTION CONSOLE" : outputKind === "agent" ? "AGENT PROTOCOL" : "SYSTEM CONSOLE"}</span>
                    </div>
                    {diagnostics.length > 0 && (
                      <div className="flex items-center gap-1.5 border-l border-cyan-500/30 pl-3">
                        <span className="text-[10px] text-amber-400 font-bold">ERRORS:</span>
                        {diagnostics.slice(0, 4).map((diag, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              const idx = lineStartIndex(code, diag.line)
                              editorRef.current?.focus()
                              editorRef.current?.setSelectionRange(idx, idx)
                            }}
                            className="border border-amber-500/40 bg-amber-950/60 px-1 py-0.5 text-[9px] text-amber-300 hover:bg-amber-900"
                            title={diag.message}
                          >
                            L{diag.line}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-cyan-500/60 font-mono">UTF-8 // ACTIVE</span>
                </div>
                <pre className="flex-1 overflow-auto p-3 font-mono text-xs text-cyan-300/80 leading-5 select-text">
                  {output || "Workspace engine ready. Execute code or dispatch agents to inspect telemetry."}
                </pre>
              </div>
            </section>

            {/* Right Autonomous Agent Panel */}
            <aside className="hud-panel flex flex-col overflow-hidden box-glow">
              <div className="flex items-center justify-between border-b border-cyan-500/30 bg-[#020b14] px-3 py-2 font-orbitron text-xs font-bold text-glow">
                <span className="flex items-center gap-1.5">
                  <Bot size={14} />
                  AI CODER
                </span>
                <span className="text-[9px] border border-cyan-400/40 px-1 text-emerald-400">ONLINE</span>
              </div>

              {/* Agent pipeline controls */}
              <div className="p-2 border-b border-cyan-500/20 bg-[#010912]">
                <AutonomousControls
                  language={selectedLanguage}
                  filePath={selectedFile}
                  code={code}
                  instruction={prompt}
                  selection={selectedCode}
                  onProposal={p => setProposal(p)}
                  onOutput={val => {
                    setOutputKind("agent")
                    setOutput(val)
                  }}
                  onFilesChanged={() => {
                    void refreshWorkspace()
                    if (selectedFile) void openFile(selectedFile)
                  }}
                />
              </div>

              {/* Conversation log */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-xs">
                {messages.length === 0 ? (
                  <div className="border border-cyan-500/20 bg-cyan-950/20 p-3 text-cyan-400/70 text-center">
                    <div className="font-orbitron font-bold text-white mb-1">AGENT STANDBY</div>
                    <div>Specify directives or use autonomous controls to inspect, debug, and build code.</div>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 border ${
                        msg.role === "user"
                          ? "border-cyan-400/40 bg-cyan-950/40 text-cyan-200"
                          : "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                      }`}
                    >
                      <div className="text-[9px] font-orbitron uppercase text-cyan-400/60 mb-1">{msg.role}</div>
                      <pre className="whitespace-pre-wrap font-mono text-[11px] leading-4">{msg.content}</pre>
                    </div>
                  ))
                )}
              </div>

              {/* Directive input */}
              <div className="p-2.5 border-t border-cyan-500/30 bg-[#020b14]">
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void sendPrompt()
                    }
                  }}
                  placeholder="Dispatch prompt to agent matrix..."
                  className="w-full h-20 bg-cyan-950/40 border border-cyan-500/30 p-2 text-xs font-mono text-cyan-200 outline-none placeholder:text-cyan-500/40 resize-none"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[9px] text-cyan-500/50 font-mono">ENTER to send</span>
                  <button
                    onClick={() => void sendPrompt()}
                    disabled={loading || !prompt.trim()}
                    className="flex items-center gap-1.5 border border-cyan-400 bg-cyan-500/30 px-3 py-1 font-orbitron text-xs font-bold text-white hover:bg-cyan-500/40 disabled:opacity-40 box-glow"
                  >
                    <Send size={11} />
                    <span>{loading ? "DISPATCHING..." : "DISPATCH"}</span>
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ================================================================== */}
        {/* 4. AI AGENTS FULL MATRIX VIEW                                      */}
        {/* ================================================================== */}
        {systemView === "agents" && (
          <div className="h-full p-3 flex flex-col gap-3 overflow-hidden">
            <div className="hud-panel p-4 flex flex-col gap-3 box-glow">
              <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
                <span className="font-orbitron text-sm font-bold tracking-widest text-glow flex items-center gap-2">
                  <Bot size={18} />
                  AUTONOMOUS AGENT MATRIX // HOUSE OF CODING
                </span>
                <span className="border border-cyan-400 px-2 py-0.5 text-xs font-mono text-cyan-300">
                  GEMINI_AGENT_RUNTIME: ACTIVE
                </span>
              </div>
              <AutonomousControls
                language={selectedLanguage}
                filePath={selectedFile}
                code={code}
                instruction={prompt}
                selection={selectedCode}
                onProposal={p => setProposal(p)}
                onOutput={val => {
                  setOutputKind("agent")
                  setOutput(val)
                }}
                onFilesChanged={() => {
                  void refreshWorkspace()
                  if (selectedFile) void openFile(selectedFile)
                }}
              />
            </div>

            <div className="grid flex-1 grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden">
              {/* Directive Chat */}
              <div className="hud-panel p-3 flex flex-col overflow-hidden box-glow">
                <div className="font-orbitron text-xs font-bold text-glow mb-2 flex items-center gap-1.5">
                  <Zap size={13} />
                  DIRECTIVE DISPATCH CONSOLE
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-3 font-mono text-xs bg-[#010811] border border-cyan-500/20">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={`p-2.5 border ${
                        m.role === "user" ? "border-cyan-400/40 bg-cyan-950/40 text-cyan-200" : "border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
                      }`}
                    >
                      <div className="text-[9px] font-orbitron uppercase text-cyan-400/60 mb-1">{m.role}</div>
                      <pre className="whitespace-pre-wrap">{m.content}</pre>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") void sendPrompt()
                    }}
                    placeholder="Enter command for autonomous loop..."
                    className="flex-1 bg-cyan-950/40 border border-cyan-500/30 px-3 py-2 text-xs font-mono text-cyan-200 outline-none"
                  />
                  <button
                    onClick={() => void sendPrompt()}
                    disabled={loading || !prompt.trim()}
                    className="border border-cyan-400 bg-cyan-500/30 px-4 py-2 font-orbitron text-xs font-bold text-white box-glow"
                  >
                    DISPATCH
                  </button>
                </div>
              </div>

              {/* Telemetry Output */}
              <div className="hud-panel p-3 flex flex-col overflow-hidden box-glow">
                <div className="font-orbitron text-xs font-bold text-glow mb-2 flex items-center gap-1.5">
                  <Terminal size={13} />
                  EXECUTION & VERIFICATION STREAM
                </div>
                <pre className="flex-1 overflow-auto p-3 font-mono text-xs text-cyan-300/80 leading-5 bg-[#010811] border border-cyan-500/20 select-text">
                  {output || "System telemetry streaming nominal. No active errors."}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER BAR */}
      <footer className="relative z-30 flex items-center justify-between border-t border-cyan-500/30 bg-[#020912]/95 px-4 py-1.5 text-[9px] font-mono text-cyan-400/60">
        <div className="flex items-center gap-4">
          <span>SYS_NODE: ALPHA-7</span>
          <span>•</span>
          <span className="text-emerald-400 font-bold">ALL SUBSYSTEMS NOMINAL</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">PROJECT: {project?.name ?? "HouseOfCoding"}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{files.length} ASSETS LOADED</span>
          <span>•</span>
          <span>CYBERNETIC OS © 2026</span>
        </div>
      </footer>
    </main>
  )
}
