"use client"

import { useState } from "react"
import { BrainCircuit, Bug, CheckCircle2, Code2, FlaskConical, ShieldCheck } from "lucide-react"
import { runAutonomous } from "../lib/api"

export type AgentAction = "code" | "debug" | "test" | "review" | "auto"

export function AutonomousControls({
  language,
  filePath,
  instruction,
  onOutput
}: {
  language: string
  filePath: string
  instruction: string
  onOutput: (value: string) => void
}) {
  const [running, setRunning] = useState<AgentAction | null>(null)

  async function run(action: AgentAction) {
    if (running) return
    setRunning(action)

    try {
      const task = instruction.trim() || "Inspect the current file and improve it without breaking its behavior."
      const modePrompt = {
        code: `${task}\n\nWork as the coding agent. Make the requested implementation changes in the workspace.`,
        debug: `${task}\n\nAct as a debugger. Inspect the current implementation and fix the most likely correctness/runtime issues.`,
        test: `${task}\n\nAct as a testing agent. Improve the current implementation where needed for correctness, edge cases, and testability.`,
        review: `${task}\n\nAct as a senior reviewer. Improve the implementation for correctness, security, maintainability, and performance.`,
        auto: `${task}\n\nRun the autonomous coding workflow: implement, execute, diagnose failures, correct them, and verify the result.`
      }[action]

      onOutput(`Starting ${action.toUpperCase()}...\n`)

      const result = await runAutonomous({
        instruction: modePrompt,
        language,
        filePath,
        maxIterations: action === "auto" ? 3 : 1
      })

      const events = result.result.events
        .map(event => `[${event.iteration}] ${event.stage.toUpperCase()}: ${event.message}`)
        .join("\n")

      const execution = result.result.execution
        ? `\n\nEXIT ${result.result.execution.exitCode}\nSTDOUT:\n${result.result.execution.stdout || "(none)"}\nSTDERR:\n${result.result.execution.stderr || "(none)"}`
        : ""

      const agentOutput = result.result.tests?.content || result.result.debug?.content || ""
      onOutput(`${events}${execution}${agentOutput ? `\n\nAGENT ANALYSIS:\n${agentOutput}` : ""}`)
    } catch (error) {
      onOutput(error instanceof Error ? error.message : `${action} failed`)
    } finally {
      setRunning(null)
    }
  }

  const actions: Array<{ id: AgentAction; label: string; icon: typeof Code2 }> = [
    { id: "code", label: "Code", icon: Code2 },
    { id: "debug", label: "Debug", icon: Bug },
    { id: "test", label: "Test", icon: FlaskConical },
    { id: "review", label: "Review", icon: ShieldCheck },
    { id: "auto", label: "Auto", icon: BrainCircuit }
  ]

  return (
    <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1">
      {actions.map(action => {
        const Icon = action.icon
        const active = running === action.id

        return (
          <button
            key={action.id}
            onClick={() => void run(action.id)}
            disabled={running !== null}
            title={`${action.label} agent`}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs transition ${
              active
                ? "bg-white text-black"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {active ? <CheckCircle2 size={13} /> : <Icon size={13} />}
            {active ? "Running" : action.label}
          </button>
        )
      })}
    </div>
  )
}
