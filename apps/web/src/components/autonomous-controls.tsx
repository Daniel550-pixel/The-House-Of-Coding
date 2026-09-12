"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BrainCircuit, Bug, Code2, FlaskConical, ShieldCheck, WandSparkles, Zap, Pause, RotateCcw, Radio, GitPullRequest, CircleDot } from "lucide-react"
import { analyzeTests, debugCode, generateCode, reviewCode, runAutonomous } from "../lib/api"

export type AgentAction = "code" | "debug" | "test" | "review" | "refactor" | "auto"

type AgentState = "idle" | "running" | "waiting" | "complete"

const phases = ["PLAN", "CODE", "EXECUTE", "VERIFY", "REVIEW"] as const

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
  const [state, setState] = useState<AgentState>("idle")
  const [phase, setPhase] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [events, setEvents] = useState<string[]>([])

  useEffect(() => {
    if (!startedAt) return
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 250)
    return () => window.clearInterval(timer)
  }, [startedAt])

  const elapsedLabel = useMemo(() => {
    const seconds = elapsed / 1000
    return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
  }, [elapsed])

  function log(message: string) {
    setEvents(current => [...current.slice(-5), message])
  }

  const run = useCallback(
    async (action: AgentAction) => {
      if (running) return
      setRunning(action)
      setState("running")
      setPhase(action === "auto" ? 0 : action === "code" || action === "refactor" ? 1 : action === "test" || action === "review" ? 3 : 2)
      setStartedAt(Date.now())
      setElapsed(0)
      setEvents([])

      const baseTask = instruction.trim() || "Inspect the current file and improve it without breaking its behavior."
      const selectedContext = selection?.trim()
        ? `\n\nThe user selected this exact code. Treat it as the primary scope for this action:\n---\n${selection}\n---`
        : ""
      const task = `${baseTask}${selectedContext}`

      try {
        log(`DISPATCH  ${action.toUpperCase()} agent`)
        onOutput(`Starting ${action.toUpperCase()} agent...\n`, action)

        if (action === "code" || action === "refactor") {
          setPhase(1)
          log("CODE     generating proposal")
          const result = await generateCode({
            instruction: `${task}\n\nFocus on the selected file when possible: ${filePath}${action === "refactor" ? "\n\nRefactor the selected code for clarity, maintainability, and correctness while preserving behavior." : ""}`,
            language,
            projectId: "house",
            apply: false
          })
          const files = result.result.files?.length ? `\n\nChanged files:\n${result.result.files.join("\n")}` : ""
          setPhase(4)
          if (result.result.changes?.length) {
            log(`REVIEW   ${result.result.changes.length} file change(s) awaiting approval`)
            setState("waiting")
            onProposal?.({ changes: result.result.changes, action, summary: result.result.response ?? "AI proposed changes." })
            onOutput(`Proposal ready: ${result.result.changes.length} file change(s). Review the diff before applying.`, action)
          } else {
            log("VERIFY   no file changes proposed")
            setState("complete")
            onOutput(`${result.result.response ?? "No response returned."}${files}`, action)
          }
          return
        }

        if (action === "debug") {
          setPhase(2)
          log("EXECUTE  inspecting failure context")
          const result = await debugCode({ error: task, code, language })
          setPhase(4)
          log("REVIEW   debugger analysis ready")
          setState("complete")
          onOutput(result.result.content || "Debugger returned no analysis.", action)
          return
        }

        if (action === "test") {
          setPhase(3)
          log("VERIFY   analyzing test coverage")
          const result = await analyzeTests({ path: filePath, language })
          setPhase(4)
          log("REVIEW   test analysis ready")
          setState("complete")
          onOutput(result.result.content || "Test agent returned no analysis.", action)
          return
        }

        if (action === "review") {
          setPhase(4)
          log("REVIEW   auditing target workspace")
          const result = await reviewCode({ path: filePath, code, language })
          log("VERIFY   review complete")
          setState("complete")
          onOutput(result.result.content || "Reviewer returned no analysis.", action)
          return
        }

        setPhase(0)
        log("PLAN     autonomous loop initialized")
        const result = await runAutonomous({ instruction: task, language, filePath, maxIterations: 3 })
        const eventsText = result.result.events.map(event => `[${event.iteration}] ${event.stage.toUpperCase()}: ${event.message}`).join("\n")
        const execution = result.result.execution
          ? `\n\nEXIT ${result.result.execution.exitCode}\nSTDOUT:\n${result.result.execution.stdout || "(none)"}\nSTDERR:\n${result.result.execution.stderr || "(none)"}`
          : ""
        const analysis = result.result.debug?.content || result.result.tests?.content || ""
        setPhase(4)
        log("VERIFY   autonomous cycle returned")
        setState("complete")
        onOutput(`${eventsText}${execution}${analysis ? `\n\nAGENT ANALYSIS:\n${analysis}` : ""}`, action)
        onFilesChanged?.()
      } catch (error) {
        setState("complete")
        log("FAULT    agent execution failed")
        onOutput(error instanceof Error ? error.message : `${action} failed`, action)
      } finally {
        setRunning(null)
        setStartedAt(null)
      }
    },
    [running, instruction, selection, onOutput, filePath, language, onProposal, code, onFilesChanged]
  )

  const actions: Array<{ id: AgentAction; label: string; description: string; icon: typeof Code2 }> = [
    { id: "code", label: "BUILD", description: "propose change", icon: Code2 },
    { id: "debug", label: "DEBUG", description: "trace fault", icon: Bug },
    { id: "test", label: "TEST", description: "verify behavior", icon: FlaskConical },
    { id: "review", label: "REVIEW", description: "audit result", icon: ShieldCheck },
    { id: "refactor", label: "REFINE", description: "improve design", icon: WandSparkles }
  ]

  return (
    <section className="agent-command-center" data-running={running ? "true" : "false"}>
      <div className="agent-command-header">
        <div className="agent-identity">
          <div className={`agent-orb ${running ? "is-active" : ""}`}><BrainCircuit size={18} /></div>
          <div>
            <div className="agent-kicker"><Radio size={10} /> AGENT RUNTIME</div>
            <strong>COMMAND CENTER</strong>
          </div>
        </div>
        <div className="agent-runtime-status">
          <span className={`agent-status-dot ${state}`} />
          <span>{state === "running" ? `${running?.toUpperCase()} ACTIVE` : state === "waiting" ? "AWAITING APPROVAL" : state === "complete" ? "MISSION COMPLETE" : "READY"}</span>
          <span className="agent-timer">{elapsedLabel}</span>
        </div>
      </div>

      <div className="agent-mission-grid">
        <div className="agent-mission-card">
          <div className="agent-section-label"><CircleDot size={11} /> CURRENT MISSION</div>
          <div className="agent-mission-title">{instruction.trim() || "Inspect and improve the active workspace"}</div>
          <div className="agent-target"><Code2 size={11} /> {filePath || "No target selected"} <span>· {language}</span></div>
        </div>

        <div className="agent-pipeline">
          {phases.map((item, index) => (
            <div key={item} className={`agent-phase ${index < phase ? "done" : ""} ${index === phase && running ? "active" : ""}`}>
              <span>{index + 1}</span>
              <label>{item}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="agent-fleet">
        <div className="agent-section-label"><GitPullRequest size={11} /> AGENT FLEET</div>
        <div className="agent-fleet-grid">
          {actions.map((action, index) => {
            const Icon = action.icon
            const active = running === action.id
            return (
              <button
                key={action.id}
                onClick={() => void run(action.id)}
                disabled={running !== null}
                className={`agent-fleet-card ${active ? "active" : ""}`}
              >
                <span className="agent-fleet-index">0{index + 1}</span>
                <Icon size={16} />
                <strong>{active ? "RUNNING" : action.label}</strong>
                <small>{action.description}</small>
              </button>
            )
          })}
          <button
            onClick={() => void run("auto")}
            disabled={running !== null}
            className={`agent-fleet-card agent-autonomous ${running === "auto" ? "active" : ""}`}
          >
            <span className="agent-fleet-index">06</span>
            <Zap size={17} />
            <strong>{running === "auto" ? "RUNNING" : "AUTONOMOUS"}</strong>
            <small>plan → execute → verify</small>
          </button>
        </div>
      </div>

      <div className="agent-activity">
        <div className="agent-section-label"><TerminalIcon /> LIVE ACTIVITY</div>
        <div className="agent-activity-stream">
          {events.length === 0 ? (
            <span className="agent-idle-message">Runtime ready. Dispatch an agent to begin a mission.</span>
          ) : events.map((event, index) => <div key={`${event}-${index}`} className="agent-event"><span>{String(index + 1).padStart(2, "0")}</span>{event}</div>)}
        </div>
        <div className="agent-actions">
          <button className="agent-secondary-action" disabled={!running}><Pause size={12} /> PAUSE</button>
          <button className="agent-secondary-action" disabled={!state || state === "idle"}><RotateCcw size={12} /> RESET</button>
          <div className="agent-approval-state">
            <span className={`agent-status-dot ${state}`} />
            {state === "waiting" ? "HUMAN APPROVAL REQUIRED" : state === "complete" ? "RESULT AVAILABLE" : "HUMAN CONTROL ENABLED"}
          </div>
        </div>
      </div>
    </section>
  )
}

function TerminalIcon() {
  return <span className="agent-terminal-mark">›_</span>
}
