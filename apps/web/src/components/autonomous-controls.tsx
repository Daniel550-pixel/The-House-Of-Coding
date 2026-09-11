"use client"

import { useState } from "react"
import { Bug, BrainCircuit, FlaskConical, ShieldCheck } from "lucide-react"
import { runAutonomous } from "../lib/api"

export function AutonomousControls({
  language,
  filePath,
  onOutput
}: {
  language: string
  filePath: string
  onOutput: (value: string) => void
}) {
  const [running, setRunning] = useState(false)

  async function run() {
    if (running) return
    setRunning(true)
    onOutput("Starting autonomous coding loop...\n")

    try {
      const result = await runAutonomous({
        instruction: "Inspect the current file, improve it without breaking its behavior, execute it, and fix any execution errors.",
        language,
        filePath,
        maxIterations: 3
      })

      const events = result.result.events
        .map(event => `[${event.iteration}] ${event.stage.toUpperCase()}: ${event.message}`)
        .join("\n")

      const execution = result.result.execution
        ? `\n\nEXIT ${result.result.execution.exitCode}\nSTDOUT:\n${result.result.execution.stdout || "(none)"}\nSTDERR:\n${result.result.execution.stderr || "(none)"}`
        : ""

      onOutput(`${events}${execution}`)
    } catch (error) {
      onOutput(error instanceof Error ? error.message : "Autonomous loop failed")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1">
      <button onClick={() => void run()} disabled={running} title="Autonomous coding loop" className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-50">
        <BrainCircuit size={14} />
        {running ? "Agent" : "Auto"}
      </button>
      <div className="hidden items-center gap-1 px-2 text-[10px] text-neutral-600 md:flex">
        <Bug size={11} />
        <FlaskConical size={11} />
        <ShieldCheck size={11} />
      </div>
    </div>
  )
}
