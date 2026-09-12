"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AudioLines, BrainCircuit, Bug, Code2, Crosshair, EyeOff, FlaskConical, Gauge, GitPullRequest, Pause, Radio, RotateCcw, Shield, ShieldCheck, Terminal, Volume2, VolumeX, WandSparkles, Zap } from "lucide-react"
import { analyzeTests, debugCode, generateCode, reviewCode, runAutonomous } from "../lib/api"

export type AgentAction = "code" | "debug" | "test" | "review" | "refactor" | "auto"
type AgentState = "idle" | "running" | "waiting" | "complete"
type HudMode = "TARGETING" | "DIAGNOSTICS" | "DEFENSE" | "STEALTH"

const phases = ["PLAN", "CODE", "EXECUTE", "VERIFY", "REVIEW"] as const
const modes: Array<{ id: HudMode; icon: typeof Crosshair }> = [
  { id: "TARGETING", icon: Crosshair },
  { id: "DIAGNOSTICS", icon: Gauge },
  { id: "DEFENSE", icon: Shield },
  { id: "STEALTH", icon: EyeOff }
]

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
  const [clock, setClock] = useState("00:00:00")
  const [events, setEvents] = useState<string[]>([])
  const [mode, setMode] = useState<HudMode>("TARGETING")
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [sweepSpeed, setSweepSpeed] = useState(5)
  const [radarZoom, setRadarZoom] = useState(1)
  const [targetLocked, setTargetLocked] = useState(false)
  const [telemetryTick, setTelemetryTick] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 250)
    return () => window.clearInterval(timer)
  }, [startedAt])

  useEffect(() => {
    const updateClock = () => setClock(new Date().toISOString().slice(11, 19))
    updateClock()
    const timer = window.setInterval(updateClock, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setTelemetryTick(value => value + 1), 2000)
    return () => window.clearInterval(timer)
  }, [])

  const elapsedLabel = useMemo(() => {
    const seconds = elapsed / 1000
    return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
  }, [elapsed])

  const telemetry = useMemo(() => ({
    temp: (37.5 + Math.sin(telemetryTick * 0.8) * 1.2).toFixed(1),
    load: Math.round(42 + Math.sin(telemetryTick * 0.65) * 8),
    flux: Math.round(78 + Math.cos(telemetryTick * 0.5) * 10),
    neural: Math.round(91 + Math.sin(telemetryTick * 0.35) * 5),
    thermal: Math.round(34 + Math.cos(telemetryTick * 0.7) * 7),
    freq: (55 + Math.sin(telemetryTick * 0.4) * 3.8).toFixed(1)
  }), [telemetryTick])

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

  function emitClientLog(message: string) {
    log(message)
    onOutput(message, "auto")
  }

  return (
    <section className="agent-command-center" data-running={running ? "true" : "false"} data-mode={mode}>
      <div className="agent-hud-shell">
        <div className="agent-hud-grid" />
        <header className="agent-command-header">
          <div className="agent-identity">
            <div className={`agent-orb ${running ? "is-active" : ""}`}><BrainCircuit size={18} /></div>
            <div>
              <div className="agent-kicker"><Radio size={10} /> CYBER-OS // AGENT RUNTIME</div>
              <strong>NEXUS-HUD v4.9.2</strong>
            </div>
          </div>
          <div className="agent-runtime-status">
            <span className={`agent-status-dot ${state}`} />
            <span>{state === "running" ? `${running?.toUpperCase()} ACTIVE` : state === "waiting" ? "AWAITING APPROVAL" : state === "complete" ? "MISSION COMPLETE" : "READY"}</span>
            <span className="agent-timer">{elapsedLabel}</span>
          </div>
          <button className="agent-sound-toggle" type="button" onClick={() => setSoundEnabled(value => !value)}>
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            AUDIO {soundEnabled ? "ON" : "OFF"}
          </button>
        </header>

        <div className="agent-hud-body">
          <aside className="agent-hud-panel agent-hud-left">
            <div className="agent-hud-panel-title"><span><Gauge size={11}/> DIAGNOSTICS</span><b>SYS_LOG</b></div>
            <div className="agent-status-grid">
              <div><span>SYSTEM STATUS</span><strong><i className="live"/> ONLINE</strong></div>
              <div><span>ENCRYPTION</span><strong>256-BIT AES</strong></div>
              <div><span>POWER CELL</span><strong>{Math.max(92, 99 - telemetryTick % 7)}% OPTIMAL</strong></div>
              <div><span>SHIELD MATRIX</span><strong>ACTIVE 100%</strong></div>
            </div>
            <HudBar label="QUANTUM FLUX" value={telemetry.flux} />
            <HudBar label="NEURAL SYNAPSE" value={telemetry.neural} />
            <HudBar label="THERMAL BUFFER" value={telemetry.thermal} />
            <div className="agent-terminal-block">
              <div className="agent-subhead"><span>LIVE TERMINAL LOG</span><Terminal size={10}/></div>
              <div className="agent-terminal-log">
                {(events.length ? events : ["System initializing...", "Core telemetry online.", "Subsystem check complete."]).map((event, index) => (
                  <div key={`${event}-${index}`}>[{clock}] {event}</div>
                ))}
              </div>
            </div>
            <div className="agent-scan-controls">
              <div className="agent-hud-section-label">SCAN CONTROLS</div>
              <label>SWEEP SPEED<input type="range" min="1" max="10" value={sweepSpeed} onChange={event => setSweepSpeed(Number(event.target.value))}/></label>
              <label>RADAR ZOOM<input type="range" min="1" max="2" step="0.1" value={radarZoom} onChange={event => setRadarZoom(Number(event.target.value))}/></label>
            </div>
          </aside>

          <section className="agent-hud-center">
            <div className="agent-mode-row">
              {modes.map(({ id, icon: Icon }) => (
                <button key={id} type="button" className={mode === id ? "active" : ""} onClick={() => { setMode(id); emitClientLog(`HUD Mode switched to ${id}`) }}>
                  <Icon size={11}/>{id}
                </button>
              ))}
            </div>
            <div className="agent-radar-stage" style={{ transform: `scale(${radarZoom})` }}>
              <svg className="agent-radar" viewBox="0 0 600 400" aria-label="Agent radar display">
                <g fill="none" stroke="currentColor">
                  <rect x="100" y="50" width="400" height="300" rx="150" className="radar-spin-cw" opacity=".42"/>
                  <rect x="140" y="80" width="320" height="240" rx="120" className="radar-spin-ccw" opacity=".28"/>
                  <circle cx="300" cy="200" r="110" strokeDasharray="12 6" opacity=".62"/>
                  <circle cx="300" cy="200" r="70" strokeDasharray="8 8" opacity=".42"/>
                  <circle cx="300" cy="200" r="30" strokeWidth="2" className="radar-pulse"/>
                  <line x1="300" y1="20" x2="300" y2="380" strokeDasharray="4 4" opacity=".38"/>
                  <line x1="50" y1="200" x2="550" y2="200" strokeDasharray="4 4" opacity=".38"/>
                  <path d="M300 10V25M300 375V390M10 200H25M575 200H590" strokeWidth="2"/>
                  <g className="radar-targets">
                    {[{x:210,y:150,id:"TGT-01"},{x:390,y:225,id:"TGT-02"},{x:405,y:270,id:"TGT-03"},{x:280,y:125,id:"TGT-04"}].map((target, index) => (
                      <g key={target.id} className={targetLocked && index === 0 ? "locked" : ""}>
                        <circle cx={target.x} cy={target.y} r={targetLocked && index === 0 ? 6 : 4} fill="currentColor"/>
                        <rect x={target.x - 8} y={target.y - 8} width="16" height="16"/>
                        <text x={target.x + 12} y={target.y + 3} className="agent-radar-text">{target.id}</text>
                      </g>
                    ))}
                  </g>
                </g>
                <text x="300" y="28" textAnchor="middle" className="agent-radar-label">TARGET // {language.toUpperCase()}</text>
                <text x="300" y="382" textAnchor="middle" className="agent-radar-label">MISSION // {running ? "LIVE" : "READY"}</text>
              </svg>
            </div>
            <div className="agent-radar-stats"><span>MODE: <b>{mode}</b></span><span>TARGETS DETECTED: <b>4</b></span><span>LOCK STATUS: <b className={targetLocked ? "locked-text" : "nominal"}>{targetLocked ? "TARGET LOCKED [TGT-01]" : "SEARCHING"}</b></span></div>
            <div className="agent-hud-command-row">
              <button onClick={() => void run("code")} disabled={!!running || !filePath}><Code2 size={12}/> BUILD</button>
              <button onClick={() => void run("auto")} disabled={!!running || !filePath}><Zap size={12}/> AUTONOMOUS</button>
              <button onClick={() => emitClientLog(`Sweep speed set to ${sweepSpeed}`)}><Radio size={12}/> PING</button>
            </div>
          </section>

          <aside className="agent-hud-panel agent-hud-right">
            <div className="agent-hud-panel-title"><span><Radio size={11}/> AUX READOUTS</span><b>SEC_08</b></div>
            <div className="agent-coordinate-card"><span>TARGET COORDINATES</span><div><strong>{(142.85 + Math.sin(telemetryTick) * 4).toFixed(2)}</strong><strong>{(-89.41 + Math.cos(telemetryTick) * 3).toFixed(2)}</strong><strong>{(512.04 + telemetryTick * 2).toFixed(2)}</strong></div></div>
            <div className="agent-wave"><div><span>FREQUENCY WAVE</span><b>{telemetry.freq} Hz</b></div><div className="agent-wave-line"><span/><span/><span/><span/><span/><span/><span/></div></div>
            <div className="agent-readout-list"><div><span>RADIAL BEARING:</span><strong>214.5° SE</strong></div><div><span>RELATIVE VELOCITY:</span><strong>Mach 3.2</strong></div><div><span>THREAT LEVEL:</span><strong className="nominal">LOW / NOMINAL</strong></div></div>
            <div className="agent-diagnostics-card"><b>RUNTIME DIAGNOSTICS</b><div><span>RUNTIME</span><strong>{language.toUpperCase()}</strong></div><div><span>LATENCY</span><strong>1.{(2 + telemetryTick % 7)}MS</strong></div><div><span>SESSION</span><strong>{state.toUpperCase()}</strong></div><div><span>APPROVAL</span><strong>{state === "waiting" ? "REQUIRED" : "CLEAR"}</strong></div></div>
            <div className="agent-hud-actions">
              <button type="button" onClick={() => { setTargetLocked(value => !value); emitClientLog(targetLocked ? "TARGET LOCK RELEASED" : "TARGET LOCK ENGAGED: TGT-01") }}><Crosshair size={12}/> {targetLocked ? "RELEASE TARGET LOCK" : "TOGGLE TARGET LOCK"}</button>
              <button type="button" onClick={() => emitClientLog("ACTIVE SONAR PING EMITTED") }><AudioLines size={12}/> EMIT ACTIVE PING</button>
            </div>
          </aside>
        </div>

        <div className="agent-mission-strip">
          <div><span>CURRENT MISSION</span><strong>{instruction.trim() || "Inspect and improve the active workspace"}</strong><small>{filePath || "No target selected"} · {language}</small></div>
          <div className="agent-pipeline">{phases.map((item, index) => <span key={item} className={`${index < phase ? "done" : ""} ${index === phase && running ? "active" : ""}`}><i>{index + 1}</i>{item}</span>)}</div>
        </div>

        <div className="agent-fleet">
          <div className="agent-fleet-title"><GitPullRequest size={11}/> AGENT FLEET</div>
          <div className="agent-fleet-grid">
            {actions.map(action => {
              const Icon = action.icon
              const active = running === action.id
              return <button key={action.id} onClick={() => void run(action.id)} disabled={!!running} className={active ? "active" : ""}><Icon size={14}/><strong>{active ? "RUNNING" : action.label}</strong><small>{action.description}</small></button>
            })}
            <button onClick={() => void run("auto")} disabled={!!running} className={running === "auto" ? "active autonomous" : "autonomous"}><Zap size={14}/><strong>{running === "auto" ? "RUNNING" : "AUTONOMOUS"}</strong><small>plan → execute → verify</small></button>
          </div>
        </div>

        <div className="agent-activity">
          <div className="agent-subhead"><span>LIVE ACTIVITY</span><span>{soundEnabled ? "AUDIO LINK" : "SILENT LINK"}</span></div>
          <div className="agent-activity-stream">{events.length ? events.map((event, index) => <div key={`${event}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{event}</div>) : <span className="agent-idle-message">Runtime ready. Dispatch an agent to begin a mission.</span>}</div>
          <div className="agent-actions"><button className="agent-secondary-action" disabled={!running}><Pause size={12}/> PAUSE</button><button className="agent-secondary-action" disabled={state === "idle"} onClick={() => { setRunning(null); setState("idle"); setPhase(0); setEvents([]) }}><RotateCcw size={12}/> RESET</button><div className="agent-approval-state"><span className={`agent-status-dot ${state}`} />{state === "waiting" ? "HUMAN APPROVAL REQUIRED" : state === "complete" ? "RESULT AVAILABLE" : "HUMAN CONTROL ENABLED"}</div></div>
        </div>
      </div>
    </section>
  )
}

function HudBar({ label, value }: { label: string; value: number }) {
  return <div className="agent-hud-bar"><div><span>{label}</span><b>{value}%</b></div><div><i style={{ width: `${value}%` }}/></div></div>
}
