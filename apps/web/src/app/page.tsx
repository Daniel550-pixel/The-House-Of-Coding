"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FileCode2,
  FolderOpen,
  Play,
  RefreshCw,
  Save,
  Send,
  Settings,
  Terminal,
  Wand2
} from "lucide-react"
import { AutonomousControls } from "../components/autonomous-controls"
import {
  executeFile,
  generateCode,
  getLanguages,
  getProjectFile,
  getProjectFiles,
  getProjects,
  saveProjectFile,
  type LanguageRuntime,
  type Project,
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
  const root: TreeNode = {
    name: "root",
    path: "",
    kind: "folder",
    children: []
  }

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split("/").filter(Boolean)
    let current = root

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1
      const path = parts.slice(0, index + 1).join("/")
      let node = current.children.find(child => child.name === part)

      if (!node) {
        node = {
          name: part,
          path,
          kind: isFile ? "file" : "folder",
          children: []
        }
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

function AgentTreeNode({
  node,
  depth,
  selectedFile,
  onOpen
}: {
  node: TreeNode
  depth: number
  selectedFile: string
  onOpen: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isSelected = node.kind === "file" && node.path === selectedFile

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
          <AgentTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedFile={selectedFile}
            onOpen={onOpen}
          />
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
          : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
      }`}
      style={{ paddingLeft: `${22 + depth * 12}px` }}
      title={node.path}
    >
      <FileCode2 size={14} />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export default function Home() {
  const [project, setProject] = useState<Project | null>(null)
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [languages, setLanguages] = useState<LanguageRuntime[]>([])
  const [selectedFile, setSelectedFile] = useState(DEFAULT_FILE)
  const [selectedLanguage, setSelectedLanguage] = useState("typescript")
  const [code, setCode] = useState("")
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [output, setOutput] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState("Connecting to workspace")

  const tree = useMemo(() => buildTree(files), [files])
  const selectedRuntime = useMemo(
    () => languages.find(item => item.language === selectedLanguage),
    [languages, selectedLanguage]
  )
  const numbers = useMemo(() => lineNumbers(code), [code])

  async function refreshWorkspace() {
    setStatus("Refreshing workspace")

    try {
      const [projectData, fileData, languageData] = await Promise.all([
        getProjects(),
        getProjectFiles(PROJECT_ID),
        getLanguages()
      ])

      setProject(projectData.projects[0] ?? null)
      setFiles(fileData.files)
      setLanguages(languageData.languages)
      setStatus("Ready")
    } catch (error) {
      setStatus(formatError(error, "Workspace unavailable"))
    }
  }

  async function openFile(path: string) {
    setStatus(`Opening ${path}`)

    try {
      const result = await getProjectFile(PROJECT_ID, path)
      setSelectedFile(path)
      setCode(result.content)
      setSelectedLanguage(detectLanguage(path, languages))
      setOutput("")
      setStatus("Ready")
    } catch (error) {
      setStatus(formatError(error, "Unable to open file"))
    }
  }

  async function saveFile() {
    if (!selectedFile || saving) return

    setSaving(true)
    setStatus("Saving")

    try {
      await saveProjectFile(PROJECT_ID, selectedFile, code)
      setStatus("Saved")
    } catch (error) {
      setStatus(formatError(error, "Save failed"))
    } finally {
      setSaving(false)
    }
  }

  async function runCurrentFile() {
    if (!selectedFile || running) return

    setRunning(true)
    setOutput("Saving current file...\n")

    try {
      await saveProjectFile(PROJECT_ID, selectedFile, code)
      const result = await executeFile({
        language: selectedLanguage,
        filePath: selectedFile
      })

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

    setMessages(current => [
      ...current,
      { role: "user", content: instruction }
    ])
    setPrompt("")
    setLoading(true)

    try {
      const result = await generateCode({
        instruction: `${instruction}\n\nThe currently selected file is ${selectedFile}. Preserve unrelated files unless a change is required.`,
        language: selectedLanguage,
        projectId: PROJECT_ID,
        apply: true
      })

      const changedFiles = result.result.files?.length
        ? `\n\nChanged files:\n${result.result.files.join("\n")}`
        : ""

      setMessages(current => [
        ...current,
        {
          role: "assistant",
          content: `${result.result.response ?? "No response returned."}${changedFiles}`
        }
      ])

      await refreshWorkspace()
      await openFile(selectedFile)
    } catch (error) {
      setMessages(current => [
        ...current,
        {
          role: "assistant",
          content: formatError(error, "Unable to reach the Coding Agent.")
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshWorkspace()
  }, [])

  useEffect(() => {
    if (files.length > 0 && files.some(file => file.path === DEFAULT_FILE)) {
      void openFile(DEFAULT_FILE)
    }
  }, [files.length])

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex h-16 items-center justify-between border-b border-neutral-800 px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-black">
            <Wand2 size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-wide">THE HOUSE OF CODING</div>
            <div className="truncate text-xs text-neutral-500">{project?.name ?? "Workspace"}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void refreshWorkspace()}
            className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:text-white"
            title="Refresh workspace"
          >
            <RefreshCw size={16} />
          </button>

          <AutonomousControls
            language={selectedLanguage}
            filePath={selectedFile}
            code={code}
            instruction={prompt}
            onOutput={setOutput}
            onFilesChanged={() => {
              void refreshWorkspace()
              void openFile(selectedFile)
            }}
          />

          <div className="hidden items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 xl:flex">
            <span className="text-xs text-neutral-500">Language</span>
            <select
              value={selectedLanguage}
              onChange={event => setSelectedLanguage(event.target.value)}
              className="bg-transparent text-sm outline-none"
            >
              {languages.map(language => (
                <option key={language.language} value={language.language} className="bg-neutral-900">
                  {language.language}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>

          <button
            onClick={() => void runCurrentFile()}
            disabled={running}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            <Play size={15} />
            {running ? "Running" : "Run"}
          </button>

          <button
            onClick={() => void saveFile()}
            disabled={saving}
            className="rounded-lg border border-neutral-800 p-2 text-neutral-300 disabled:opacity-50"
            title={saving ? "Saving" : "Save file"}
          >
            <Save size={17} />
          </button>

          <button className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:text-white" title="Settings">
            <Settings size={17} />
          </button>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-4rem)] grid-cols-[250px_minmax(0,1fr)_380px]">
        <aside className="min-w-0 border-r border-neutral-800">
          <div className="flex h-11 items-center justify-between border-b border-neutral-800 px-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Explorer</span>
            <span className="text-[11px] text-neutral-600">{files.length} files</span>
          </div>
          <div className="border-b border-neutral-800 px-4 py-2 text-[11px] text-neutral-600">{status}</div>
          <div className="h-[calc(100vh-7rem)] overflow-auto p-2">
            <div className="mb-2 flex items-center gap-2 px-2 py-1.5 text-sm text-neutral-200">
              <FolderOpen size={15} />
              <span className="truncate">{project?.name ?? "the-house-of-coding"}</span>
            </div>
            {tree.map(node => (
              <AgentTreeNode
                key={node.path}
                node={node}
                depth={0}
                selectedFile={selectedFile}
                onOpen={path => void openFile(path)}
              />
            ))}
          </div>
        </aside>

        <section className="grid min-w-0 grid-rows-[44px_minmax(0,1fr)_220px]">
          <div className="flex min-w-0 items-center justify-between border-b border-neutral-800 px-4">
            <div className="flex min-w-0 items-center gap-3 text-sm">
              <FileCode2 size={15} />
              <span className="truncate">{selectedFile || "No file selected"}</span>
              <span className="hidden text-xs text-neutral-600 md:inline">{selectedRuntime?.command ?? "runtime unavailable"}</span>
            </div>
            <span className="text-xs text-neutral-600">{status}</span>
          </div>

          <div className="grid min-h-0 grid-cols-[54px_minmax(0,1fr)] bg-[#0b0b0b]">
            <div className="select-none overflow-hidden border-r border-neutral-900 bg-[#090909] px-3 pt-4 text-right font-mono text-xs leading-7 text-neutral-700">
              {numbers.map(number => <div key={number}>{number}</div>)}
            </div>
            <textarea
              value={code}
              onChange={event => setCode(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Tab") {
                  event.preventDefault()
                  const start = event.currentTarget.selectionStart
                  const end = event.currentTarget.selectionEnd
                  const next = `${code.slice(0, start)}  ${code.slice(end)}`
                  setCode(next)
                  requestAnimationFrame(() => {
                    event.currentTarget.selectionStart = start + 2
                    event.currentTarget.selectionEnd = start + 2
                  })
                }
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                  event.preventDefault()
                  void saveFile()
                }
              }}
              spellCheck={false}
              wrap="off"
              className="h-full w-full resize-none overflow-auto bg-transparent px-4 py-4 font-mono text-sm leading-7 text-neutral-200 outline-none"
              aria-label={`Editor for ${selectedFile}`}
            />
          </div>

          <div className="border-t border-neutral-800">
            <div className="flex h-10 items-center justify-between border-b border-neutral-800 px-4 text-xs">
              <div className="flex items-center gap-2 text-neutral-200">
                <Terminal size={14} />
                Output
              </div>
              <span className="text-neutral-600">{selectedLanguage}</span>
            </div>
            <pre className="h-[calc(100%-2.5rem)] overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-5 text-neutral-400">
              {output || "Execution, diagnostics, tests, reviews, and autonomous events will appear here."}
            </pre>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col border-l border-neutral-800">
          <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
            <Bot size={17} />
            <span className="text-sm font-semibold">AI Coder</span>
            <span className="ml-auto rounded-md border border-neutral-800 px-2 py-1 text-[10px] uppercase tracking-widest text-neutral-600">Live</span>
          </div>

          <div className="flex-1 space-y-4 overflow-auto p-4">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-800 p-5">
                <div className="mb-2 text-sm font-medium">Ready to code</div>
                <div className="text-xs leading-5 text-neutral-500">
                  Describe a change, then use Code, Debug, Test, Review, or Auto against the selected file.
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
                  <div className="mb-2 text-[10px] uppercase tracking-widest text-neutral-600">{message.role}</div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-neutral-200">{message.content}</pre>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-neutral-800 p-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900">
              <textarea
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void sendPrompt()
                  }
                }}
                placeholder="Tell the Coding Agent what to build..."
                className="h-24 w-full resize-none bg-transparent p-3 text-sm outline-none placeholder:text-neutral-600"
              />
              <div className="flex items-center justify-between border-t border-neutral-800 px-3 py-2">
                <span className="text-[11px] text-neutral-600">Enter to send · Shift+Enter for newline</span>
                <button
                  onClick={() => void sendPrompt()}
                  disabled={loading || !prompt.trim()}
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-40"
                >
                  <Send size={14} />
                  {loading ? "Working..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}
