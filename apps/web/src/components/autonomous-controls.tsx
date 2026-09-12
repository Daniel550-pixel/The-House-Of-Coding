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
    <div className="flex flex-wrap items-stretch gap-2 border border-cyan-500/40 bg-[#03101a]/90 p-1.5 box-glow rounded-none" data-running={running ? "true" : "false"}>
      <div className="flex min-w-[110px] flex-col justify-center border-r border-cyan-500/30 px-3 py-1 text-cyan-300">
        <div className="flex items-center gap-2 text-[9px] font-orbitron font-bold tracking-[.15em] text-glow">
          <span className={`h-2 w-2 rounded-full ${running ? "animate-ping bg-rose-500" : "bg-cyan-400 animate-pulse"}`} />
          AI_AGENTS
        </div>
        <div className="mt-0.5 text-[8px] tracking-widest text-cyan-400/60 font-mono">
          {running ? `${running.toUpperCase()} ACTIVE` : "SYSTEM STANDBY"}
        </div>
      </div>
      <div className="flex flex-wrap items-stretch gap-1">
        {actions.map((action, index) => {
          const Icon = action.icon
          const active = running === action.id
          return (
            <button
              key={action.id}
              onClick={() => void run(action.id)}
              disabled={running !== null}
              title={`${action.label} agent`}
              className={`group flex min-w-[72px] flex-col items-start justify-center border px-2.5 py-1 text-left transition font-orbitron ${
                active
                  ? "border-rose-500 bg-rose-950/80 text-rose-300 box-glow-red"
                  : "border-cyan-500/30 bg-cyan-950/40 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/20"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className="flex w-full items-center justify-between text-[8px] font-mono text-cyan-400/50">
                <span>0{index + 1}</span>
                {active ? <CheckCircle2 size={11} className="text-rose-400" /> : <Icon size={11} />}
              </span>
              <strong className="mt-1 text-[9px] tracking-wider font-bold">{active ? "BUSY" : action.label}</strong>
              <small className="mt-0.5 text-[7px] text-cyan-400/60 font-mono">{active ? "executing" : action.description}</small>
            </button>
          )
        })}
      </div>
      <button
        onClick={() => void run("auto")}
        disabled={running !== null}
        className={`flex min-w-[170px] items-center gap-2 border px-3 py-1.5 text-left font-orbitron transition ${
          running === "auto"
            ? "border-rose-500 bg-rose-950/80 text-rose-200 box-glow-red"
            : "border-cyan-400 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 box-glow"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className="flex h-7 w-7 items-center justify-center border border-cyan-400/50 bg-cyan-950/80 text-cyan-300">
          <BrainCircuit size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block text-[9px] tracking-widest text-glow">
            {running === "auto" ? "AUTONOMOUS LOOP" : "EXECUTE LOOP"}
          </strong>
          <small className="block text-[7px] text-cyan-400/70 font-mono">plan → code → test → verify</small>
        </span>
        <Zap size={13} className="text-cyan-300" />
      </button>
    </div>
  )
}
