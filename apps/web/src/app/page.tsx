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
  Send,
  Settings,
  Terminal,
  TestTube2,
  Wand2
} from "lucide-react"

type Language = {
  language: string
  extensions: string[]
  command: string
}

type Message = {
  role: "user" | "assistant"
  content: string
}

export default function Home() {
  const [languages, setLanguages] = useState<Language[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState("python")
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [output, setOutput] = useState("")
  const [loading, setLoading] = useState(false)

  const [code, setCode] = useState(
`def hello():
    print("Hello from The House Of Coding")

hello()
`
  )

  useEffect(() => {
    fetch("http://localhost:4000/languages")
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        return response.json()
      })
      .then(data => {
        if (Array.isArray(data.languages)) {
          setLanguages(data.languages)
        }
      })
      .catch(error => {
        console.error("Language registry error:", error)
      })
  }, [])

  const selectedRuntime = useMemo(
    () => languages.find(item => item.language === selectedLanguage),
    [languages, selectedLanguage]
  )

  async function sendPrompt() {
    if (!prompt.trim() || loading) return

    const currentPrompt = prompt.trim()

    setMessages(current => [
      ...current,
      {
        role: "user",
        content: currentPrompt
      }
    ])

    setPrompt("")
    setLoading(true)

    try {
      const response = await fetch("http://localhost:4000/code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          instruction: currentPrompt,
          language: selectedLanguage
        })
      })

      const data = await response.json()

      const content =
        data?.result?.content ??
        data?.result?.response ??
        data?.error ??
        "No response returned."

      setMessages(current => [
        ...current,
        {
          role: "assistant",
          content
        }
      ])
    } catch (error) {
      setMessages(current => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Unable to reach the Coding Agent."
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  async function runCode() {
    setOutput("Execution request sent...")

    try {
      const response = await fetch("http://localhost:4000/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          language: selectedLanguage,
          filePath: "tests/runtime/house-test.py",
          workingDirectory: "tests/runtime"
        })
      })

      const data = await response.json()

      setOutput(JSON.stringify(data, null, 2))
    } catch (error) {
      setOutput(
        error instanceof Error
          ? error.message
          : "Execution request failed."
      )
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex h-16 items-center justify-between border-b border-neutral-800 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-black">
            <Wand2 size={18} />
          </div>

          <div>
            <div className="text-sm font-semibold tracking-wide">
              THE HOUSE OF CODING
            </div>

            <div className="text-xs text-neutral-500">
              AI Coding Environment
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2">
            <span className="text-xs text-neutral-500">
              Language
            </span>

            <select
              value={selectedLanguage}
              onChange={event =>
                setSelectedLanguage(event.target.value)
              }
              className="bg-transparent text-sm outline-none"
            >
              {languages.length > 0 ? (
                languages.map(language => (
                  <option
                    key={language.language}
                    value={language.language}
                    className="bg-neutral-900"
                  >
                    {language.language}
                  </option>
                ))
              ) : (
                <option
                  value="python"
                  className="bg-neutral-900"
                >
                  python
                </option>
              )}
            </select>

            <ChevronDown size={14} />
          </div>

          <button
            onClick={runCode}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
          >
            <Play size={15} />
            Run
          </button>

          <button className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:text-white">
            <Settings size={17} />
          </button>
        </div>
      </header>

      <section className="grid min-h-[calc(100vh-4rem)] grid-cols-[220px_minmax(0,1fr)_380px]">

        <aside className="border-r border-neutral-800">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Project
            </span>

            <button className="text-neutral-500 hover:text-white">
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-1 p-3 text-sm">
            <div className="flex items-center gap-2 rounded-md px-2 py-2">
              <FolderOpen size={16} />
              the-house-of-coding
            </div>

            <div className="ml-4 flex items-center gap-2 rounded-md px-2 py-2 text-neutral-500">
              <Folder size={15} />
              apps
            </div>

            <div className="ml-4 flex items-center gap-2 rounded-md px-2 py-2 text-neutral-500">
              <Folder size={15} />
              core
            </div>

            <div className="ml-4 flex items-center gap-2 rounded-md bg-neutral-900 px-2 py-2">
              <FileCode2 size={15} />
              house-test.py
            </div>
          </div>
        </aside>

        <section className="grid min-w-0 grid-rows-[48px_minmax(0,1fr)_220px]">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4">
            <div className="flex items-center gap-3 text-sm">
              <FileCode2 size={15} />
              house-test.py

              <span className="text-xs text-neutral-600">
                {selectedRuntime?.command ?? "runtime unavailable"}
              </span>
            </div>

            <span className="text-xs text-neutral-600">
              Ready
            </span>
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

              <div className="flex items-center gap-2 text-neutral-500">
                <TestTube2 size={14} />
                Tests
              </div>
            </div>

            <pre className="h-[calc(100%-2.5rem)] overflow-auto p-4 font-mono text-xs text-neutral-400">
              {output || "Execution output will appear here."}
            </pre>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col border-l border-neutral-800">
          <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
            <Bot size={17} />
            <span className="text-sm font-semibold">
              AI Coder
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-auto p-4">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-800 p-5">
                <div className="mb-2 text-sm font-medium">
                  Ready to code
                </div>

                <div className="text-xs leading-5 text-neutral-500">
                  Ask the Coding Agent to create, modify,
                  debug, explain, or review code.
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className="rounded-xl border border-neutral-800 bg-neutral-900 p-3"
                >
                  <div className="mb-2 text-[10px] uppercase tracking-widest text-neutral-600">
                    {message.role}
                  </div>

                  <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-neutral-200">
                    {message.content}
                  </pre>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-neutral-800 p-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900">
              <textarea
                value={prompt}
                onChange={event =>
                  setPrompt(event.target.value)
                }
                onKeyDown={event => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault()
                    void sendPrompt()
                  }
                }}
                placeholder="Tell the Coding Agent what to build..."
                className="h-24 w-full resize-none bg-transparent p-3 text-sm outline-none placeholder:text-neutral-600"
              />

              <div className="flex items-center justify-between border-t border-neutral-800 px-3 py-2">
                <span className="text-[11px] text-neutral-600">
                  Enter to send · Shift+Enter for newline
                </span>

                <button
                  onClick={() => void sendPrompt()}
                  disabled={loading || !prompt.trim()}
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send size={14} />
                  {loading ? "Thinking..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}
