"use client"

import { useState } from "react"
import { BrainCircuit, Bug, CheckCircle2, Code2, FlaskConical, ShieldCheck, WandSparkles, Zap } from "lucide-react"
import {
  analyzeTests,
  debugCode,
  generateCode,
  reviewCode,
  runAutonomous
} from "../lib/api"

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
        const files = result.result.files?.length
          ? `\n\nChanged files:\n${result.result.files.join("\n")}`
          : ""
        if (result.result.changes?.length) {
          onProposal?.({ changes: result.result.changes, action, summary: result.result.response ?? "AI proposed changes." })
          onOutput(`Proposal ready: ${result.result.changes.length} file change(s). Review the diff before applying.`, action)
        } else {
          onOutput(`${result.result.response ?? "No response returned."}${files}`, action)
        }
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
      const events = result.result.events
        .map(event => `[${event.iteration}] ${event.stage.toUpperCase()}: ${event.message}`)
        .join("\n")
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
    <div className="agent-command-center" data-running={running ? "true" : "false"}>
      <div className="agent-command-header">
        <div className="agent-command-title"><span className="agent-pulse" /> AGENT CONTROL</div>
        <span className="agent-command-state">{running ? `${running.toUpperCase()} ACTIVE` : "STANDBY"}</span>
      </div>
      <div className="agent-command-actions">
        {actions.map((action, index) => {
          const Icon = action.icon
          const active = running === action.id
          return (
            <button
              key={action.id}
              onClick={() => void run(action.id)}
              disabled={running !== null}
              className={`agent-command-action ${active ? "is-active" : ""}`}
              title={`${action.label} agent`}
            >
              <span className="agent-command-index">0{index + 1}</span>
              <span className="agent-command-icon">{active ? <CheckCircle2 size={14} /> : <Icon size={14} />}</span>
              <span className="agent-command-copy"><strong>{active ? "RUNNING" : action.label}</strong><small>{active ? "agent executing" : action.description}</small></span>
            </button>
          )
        })}
      </div>
      <button
        onClick={() => void run("auto")}
        disabled={running !== null}
        className="agent-autonomous-button"
      >
        <span className="agent-auto-icon"><BrainCircuit size={17} /></span>
        <span><strong>{running === "auto" ? "AUTONOMOUS LOOP ACTIVE" : "RUN AUTONOMOUS LOOP"}</strong><small>plan → code → execute → debug → test</small></span>
        <Zap size={15} />
      </button>
    </div>
  )
}
