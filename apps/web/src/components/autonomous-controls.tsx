"use client"

import { useState } from "react"
import { BrainCircuit, Bug, CheckCircle2, Code2, FlaskConical, ShieldCheck, WandSparkles, Zap } from "lucide-react"
import { analyzeTests, debugCode, generateCode, reviewCode, runAutonomous } from "../lib/api"

export type AgentAction = "code" | "debug" | "test" | "review" | "refactor" | "auto"

export function AutonomousControls({
  language,
  filePath,
  code,
  instruction,
  selection,
  onOutput,
  onProposal,
  onFilesChanged
}: {
  language: string
  filePath: string
  code: string
  instruction: string
  selection?: string
  onOutput: (value: string, action?: AgentAction) => void
  onProposal?: (proposal: { changes: Array<{ path: string; content: string }>; action: AgentAction; summary: string }) => void
  onFilesChanged?: () => void
}) {
  const [running, setRunning] = useState<AgentAction | null>(null)

  async function run(action: AgentAction) {
    if (running) return
    setRunning(action)
    const baseTask = instruction.trim() || "Inspect the current file and improve it without breaking its behavior."
    const selectedContext = selection?.trim()
      ? `\n\nThe user selected this exact code. Treat it as the primary scope for this action:\n---\n${selection}\n---`
      : ""
    const task = `${baseTask}${selectedContext}`

    try {
      onOutput(`Starting ${action.toUpperCase()} agent...\n`, action)
      if (action === "code" || action === "refactor") {
        const result = await generateCode({
          instruction: `${task}\n\nFocus on the selected file when possible: ${filePath}${action === "refactor" ? "\n\nRefactor the selected code for clarity, maintainability, and correctness while preserving behavior." : ""}`,
          language,
          projectId: "house",
          apply: false
        })
        const files = result.result.files?.length ? `\n\nChanged files:\n${result.result.files.join("\n")}` : ""
        if (result.result.changes?.length) {
          onProposal?.({ changes: result.result.changes, action, summary: result.result.response ?? "AI proposed changes." })
          onOutput(`Proposal ready: ${result.result.changes.length} file change(s). Review the diff before applying.`, action)
        } else onOutput(`${result.result.response ?? "No response returned."}${files}`, action)
        return
      }
      if (action === "debug") {
        const result = await debugCode({ error: task, code, language })
        onOutput(result.result.content || "Debugger returned no analysis.", action)
        return
      }
      if (action === "test") {
        const result = await analyzeTests({ path: filePath, language })
        onOutput(result.result.content || "Test agent returned no analysis.", action)
        return
      }
      if (action === "review") {
        const result = await reviewCode({ path: filePath, code, language })
        onOutput(result.result.content || "Reviewer returned no analysis.", action)
        return
      }
      const result = await runAutonomous({ instruction: task, language, filePath, maxIterations: 3 })
      const events = result.result.events.map(event => `[${event.iteration}] ${event.stage.toUpperCase()}: ${event.message}`).join("\n")
      const execution = result.result.execution
        ? `\n\nEXIT ${result.result.execution.exitCode}\nSTDOUT:\n${result.result.execution.stdout || "(none)"}\nSTDERR:\n${result.result.execution.stderr || "(none)"}`
        : ""
      const analysis = result.result.debug?.content || result.result.tests?.content || ""
      onOutput(`${events}${execution}${analysis ? `\n\nAGENT ANALYSIS:\n${analysis}` : ""}`, action)
      onFilesChanged?.()
    } catch (error) {
      onOutput(error instanceof Error ? error.message : `${action} failed`, action)
    } finally {
      setRunning(null)
    }
  }

  const actions: Array<{ id: AgentAction; label: string; description: string; icon: typeof Code2 }> = [
    { id: "code", label: "BUILD", description: "write change", icon: Code2 },
    { id: "debug", label: "DEBUG", description: "find fault", icon: Bug },
    { id: "test", label: "TEST", description: "inspect tests", icon: FlaskConical },
    { id: "review", label: "REVIEW", description: "audit code", icon: ShieldCheck },
    { id: "refactor", label: "REFINE", description: "improve design", icon: WandSparkles }
  ]

  return (
    <div className="flex items-stretch gap-2 border border-[#11151a] bg-[#11151a] p-1 shadow-[4px_4px_0_rgba(240,90,40,.8)]" data-running={running ? "true" : "false"}>
      <div className="flex min-w-[112px] flex-col justify-center border-r border-white/15 px-3 py-1 text-white">
        <div className="flex items-center gap-2 text-[9px] font-bold tracking-[.2em]"><span className={`h-2 w-2 rounded-full ${running ? "animate-pulse bg-[#f05a28]" : "bg-[#36b37e]"}`} />AGENT CONTROL</div>
        <div className="mt-1 text-[8px] uppercase tracking-widest text-white/45">{running ? `${running} active` : "system standby"}</div>
      </div>
      <div className="flex items-stretch gap-1">
        {actions.map((action, index) => {
          const Icon = action.icon
          const active = running === action.id
          return (
            <button key={action.id} onClick={() => void run(action.id)} disabled={running !== null} title={`${action.label} agent`} className={`group flex min-w-[78px] flex-col items-start justify-center border px-2 py-1 text-left transition ${active ? "border-[#f05a28] bg-[#f05a28] text-white" : "border-white/10 bg-white/[.04] text-white/70 hover:border-white/30 hover:bg-white/[.09]"} disabled:cursor-not-allowed disabled:opacity-50`}>
              <span className="flex w-full items-center justify-between text-[8px] font-mono text-white/35"><span>0{index + 1}</span>{active ? <CheckCircle2 size={12} /> : <Icon size={12} />}</span>
              <strong className="mt-1 text-[9px] tracking-widest">{active ? "RUNNING" : action.label}</strong>
              <small className="mt-0.5 text-[8px] text-white/40">{active ? "executing" : action.description}</small>
            </button>
          )
        })}
      </div>
      <button onClick={() => void run("auto")} disabled={running !== null} className="flex min-w-[168px] items-center gap-2 border border-[#1546d8] bg-[#1546d8] px-3 py-2 text-left text-white transition hover:bg-[#0d2d91] disabled:cursor-not-allowed disabled:opacity-50">
        <span className="flex h-8 w-8 items-center justify-center border border-white/20 bg-white/10"><BrainCircuit size={17} /></span>
        <span className="min-w-0 flex-1"><strong className="block text-[9px] tracking-widest">{running === "auto" ? "AUTONOMOUS ACTIVE" : "AUTONOMOUS LOOP"}</strong><small className="mt-1 block text-[8px] text-white/60">plan → code → execute → debug → test</small></span>
        <Zap size={14} />
      </button>
    </div>
  )
}
