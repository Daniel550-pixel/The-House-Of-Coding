"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bot,
  ChevronDown,
  FileCode2,
  Folder,
  FolderOpen,
  Play,
  Plus,
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
  const [status, setStatus] = useState("Loading workspace")

  const selectedRuntime = useMemo(
    () => languages.find(item => item.language === selectedLanguage),
    [languages, selectedLanguage]
  )

  async function refreshWorkspace() {
    setStatus("Refreshing workspace")

    const [projectData, fileData, languageData] = await Promise.all([
      getProjects(),
      getProjectFiles(PROJECT_ID),
      getLanguages()
    ])

    setProject(projectData.projects[0] ?? null)
    setFiles(fileData.files)
    setLanguages(languageData.languages)
    setStatus("Ready")
  }

  async function openFile(path: string) {
    setStatus(`Opening ${path}`)

    try {
      const result = await getProjectFile(PROJECT_ID, path)
      setSelectedFile(path)
      setCode(result.content)
      setSelectedLanguage(detectLanguage(path, languages))
      setStatus("Ready")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to open file")
    }
  }

  async function saveFile() {
    if (!selectedFile || saving) return

    setSaving(true)
    setStatus("Saving")

    try {
      await saveProjectFile(PROJECT_ID, selectedFile, code)
      const fileData = await getProjectFiles(PROJECT_ID)
      setFiles(fileData.files)
      setStatus("Saved")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Save failed")
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
      setOutput("Saved. Executing...\n")

      const result = await executeFile({
        language: selectedLanguage,
        filePath: selectedFile
      })

      const lines = [
        `Command: ${result.result.command}`,
        `Exit code: ${result.result.exitCode}`,
        `Duration: ${result.result.durationMs} ms`,
        "",
        "STDOUT:",
        result.result.stdout || "(none)",
        "",
        "STDERR:",
        result.result.stderr || "(none)"
      ]

      setOutput(lines.join("\n"))
      setStatus(result.result.success ? "Execution successful" : "Execution failed")
    } catch (error) {
      setOutput(error instanceof Error ? error.message : "Execution failed")
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
        instruction,
        language: selectedLanguage,
        projectId: PROJECT_ID,
        apply: true
      })

      const response = result.result.response ?? "No response returned."

      setMessages(current => [
        ...current,
        {
          role: "assistant",
          content: result.result.files?.length
            ? `${response}\n\nChanged files:\n${result.result.files.join("\n")}`
            : response
        }
      ])

      await refreshWorkspace()
      await openFile(selectedFile)
    } catch (error) {
      setMessages(current => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error
            ? error.message
            : "Unable to reach the Coding Agent."
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshWorkspace().catch(error => {
      setStatus(error instanceof Error ? error.message : "Workspace unavailable")
    })
  }, [])

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex h-16 items-center justify-between border-b border-neutral-800 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-black">
            <Wand2 size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">THE HOUSE OF CODING</div>
            <div className="text-xs text-neutral-500">{project?.name ?? "Workspace"}</div>
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
            onOutput={setOutput}
          />

          <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
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
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            <Play size={15} />
            {running ? "Running" : "Run"}
          </button>

          <button
            onClick={() => void saveFile()}
            disabled={saving}
            className="rounded-lg border border-neutral-800 p-2 text-neutral-300 disabled:opacity-50"
            title="Save file"
          >
            <Save size={17} />
          </button>

          <button className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:text-white">
            <Settings size={17} />
          </button>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-4rem)] grid-cols-[280px_minmax(0,1fr)_380px]">
        <aside className="border-r border-neutral-800">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Project</span>
            <Plus size={16} className="text-neutral-600" />
          </div>

          <div className="border-b border-neutral-800 px-4 py-3 text-xs text-neutral-500">{status}</div>

          <div className="space-y-1 overflow-auto p-3 text-sm">
            <div className="flex items-center gap-2 rounded-md px-2 py-2 text-neutral-200">
              <FolderOpen size={16} />
              {project?.name ?? "the-house-of-coding"}
            </div>

            {files.map(file => (
              <button
                key={file.path}
                onClick={() => void openFile(file.path)}
                className={`ml-4 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md px-2 py-2 text-left ${
                  file.path === selectedFile
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
                }`}
              >
                <FileCode2 size={15} />
                <span className="truncate">{file.path}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="grid min-w-0 grid-rows-[48px_minmax(0,1fr)_220px]">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4">
            <div className="flex items-center gap-3 text-sm">
              <FileCode2 size={15} />
              <span>{fileName(selectedFile)}</span>
              <span className="text-xs text-neutral-600">
                {selectedRuntime?.command ?? "runtime unavailable"}
              </span>
            </div>
            <span className="text-xs text-neutral-600">{status}</span>
          </div>

          <div className="min-h-0 bg-[#0b0b0b] p-5">
            <textarea
              value={code}
              onChange={event => setCode(event.target.value)}
              spellCheck={false}
              className="h-full w-full resize-none bg-transparent font-mono text-sm leading-7 text-neutral-200 outline-none"
            />
          </div>

          <div className="border-t border-neutral-800">
            <div className="flex h-10 items-center gap-5 border-b border-neutral-800 px-4 text-xs">
              <div className="flex items-center gap-2 text-neutral-200">
                <Terminal size={14} />
                Terminal
              </div>
            </div>
            <pre className="h-[calc(100%-2.5rem)] overflow-auto whitespace-pre-wrap p-4 font-mono text-xs text-neutral-400">
              {output || "Execution output will appear here."}
            </pre>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col border-l border-neutral-800">
          <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
            <Bot size={17} />
            <span className="text-sm font-semibold">AI Coder</span>
          </div>

          <div className="flex-1 space-y-4 overflow-auto p-4">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-800 p-5">
                <div className="mb-2 text-sm font-medium">Ready to code</div>
                <div className="text-xs leading-5 text-neutral-500">
                  Use Code for direct changes or Auto for the bounded code → execute → debug → retry → test loop.
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
