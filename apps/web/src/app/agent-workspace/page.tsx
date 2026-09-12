"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bot, Bug, CheckCircle2, Code2, FileCode2, FlaskConical, FolderOpen, GitPullRequest, Play, RefreshCw, Send, ShieldCheck, Sparkles, Terminal, X, Zap } from "lucide-react"
import { AutonomousControls, type AgentAction } from "../../components/autonomous-controls"
import { createAgentSession, executeFile, getLanguages, getProjectFile, getProjectFiles, saveProjectFile, subscribeAgentSession, type AgentEvent, type AgentSession, type LanguageRuntime, type WorkspaceFile } from "../../lib/api"

type Tab = { path: string; content: string; savedContent: string }
type Proposal = { changes: Array<{ path: string; content: string }>; action: AgentAction; summary: string }
const PROJECT_ID = "house"
const DEFAULT_FILE = "apps/web/src/app/page.tsx"

function languageFor(path: string, languages: LanguageRuntime[]) {
  const ext = path.includes(".") ? `.${path.split(".").pop()}`.toLowerCase() : ""
  return languages.find(item => item.extensions.some(value => value.toLowerCase() === ext))?.language ?? "typescript"
}
function nameOf(path: string) { return path.split("/").pop() ?? path }

export default function AgentWorkspacePage() {
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [languages, setLanguages] = useState<LanguageRuntime[]>([])
  const [tabs, setTabs] = useState<Tab[]>([])
  const [selectedFile, setSelectedFile] = useState("")
  const [prompt, setPrompt] = useState("")
  const [output, setOutput] = useState("")
  const [status, setStatus] = useState("READY")
  const [search, setSearch] = useState("")
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [running, setRunning] = useState(false)
  const [session, setSession] = useState<AgentSession | null>(null)
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([])
  const [activity, setActivity] = useState<string[]>(["Runtime initialized", "Human control layer online", "Workspace awaiting mission"])

  const active = tabs.find(tab => tab.path === selectedFile)
  const code = active?.content ?? ""
  const language = languageFor(selectedFile, languages)
  const filteredFiles = useMemo(() => files.filter(file => !search.trim() || file.path.toLowerCase().includes(search.toLowerCase())), [files, search])
  const log = useCallback((message: string) => setActivity(current => [...current.slice(-7), message]), [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [fileData, languageData] = await Promise.all([getProjectFiles(PROJECT_ID), getLanguages()])
      setFiles(fileData.files); setLanguages(languageData.languages); setStatus("READY")
      log(`Workspace synchronized · ${fileData.files.length} files`)
    } catch (error) { setStatus(error instanceof Error ? error.message : "Workspace unavailable") }
    finally { setRefreshing(false) }
  }, [log])

  const openFile = useCallback(async (path: string) => {
    const existing = tabs.find(tab => tab.path === path)
    if (existing) { setSelectedFile(path); return }
    try {
      const result = await getProjectFile(PROJECT_ID, path)
      setTabs(current => [...current, { path, content: result.content, savedContent: result.content }])
      setSelectedFile(path); log(`Opened ${nameOf(path)}`)
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to open file") }
  }, [tabs, log])

  useEffect(() => {
    let ignore = false
    async function loadInitial() {
      try {
        const [fileData, languageData] = await Promise.all([getProjectFiles(PROJECT_ID), getLanguages()])
        if (ignore) return
        setFiles(fileData.files); setLanguages(languageData.languages); setStatus("READY")
        log(`Workspace synchronized · ${fileData.files.length} files`)
        if (fileData.files.some(f => f.path === DEFAULT_FILE)) {
          const result = await getProjectFile(PROJECT_ID, DEFAULT_FILE)
          if (!ignore) { setTabs([{ path: DEFAULT_FILE, content: result.content, savedContent: result.content }]); setSelectedFile(DEFAULT_FILE); log(`Opened ${nameOf(DEFAULT_FILE)}`) }
        }
      } catch (error) { if (!ignore) setStatus(error instanceof Error ? error.message : "Workspace unavailable") }
    }
    void loadInitial()
    return () => { ignore = true }
  }, [log])

  function updateCode(content: string) { setTabs(current => current.map(tab => tab.path === selectedFile ? { ...tab, content } : tab)) }
  async function save() {
    if (!active) return
    setStatus("SAVING"); await saveProjectFile({ projectId: PROJECT_ID, path: active.path, content: active.content })
    setTabs(current => current.map(tab => tab.path === active.path ? { ...tab, savedContent: tab.content } : tab)); setStatus("SAVED"); log(`Committed ${nameOf(active.path)}`)
  }
  async function execute() {
    if (!selectedFile) return
    setRunning(true); setStatus("EXECUTING"); log(`Execution started · ${nameOf(selectedFile)}`)
    try {
      await save(); const result = await executeFile({ language, filePath: selectedFile })
      setOutput(`EXIT ${result.result.exitCode}\nDURATION ${result.result.durationMs} ms\n\nSTDOUT\n${result.result.stdout || "(none)"}\n\nSTDERR\n${result.result.stderr || "(none)"}`)
      setStatus(result.result.success ? "EXECUTION PASSED" : "EXECUTION FAILED"); log(result.result.success ? "Execution passed" : "Execution returned a failure")
    } catch (error) { setOutput(error instanceof Error ? error.message : "Execution failed"); setStatus("EXECUTION FAILED") }
    finally { setRunning(false) }
  }
  async function dispatchMission() {
    if (!selectedFile) { setStatus("SELECT A TARGET"); return }
    const instruction = prompt.trim() || "Inspect the selected file, identify the highest-value improvement, and implement it safely."
    setStatus("DISPATCHING"); setRunning(true); setAgentEvents([]); log(`Mission dispatched · ${nameOf(selectedFile)}`)
    try {
      const response = await createAgentSession({ instruction, language, filePath: selectedFile, maxIterations: 3 })
      setSession(response.session); log(`Agent session ${response.session.id} online`)
      const unsubscribe = subscribeAgentSession(response.session.id, event => {
        setAgentEvents(current => [...current.slice(-19), event]); setStatus(event.stage.toUpperCase()); log(`${event.stage.toUpperCase()} · ${event.message}`)
        if (event.stage === "complete" || event.stage === "failed") { setRunning(false); void refresh() }
      }, currentSession => setSession(currentSession), () => log("Agent event stream disconnected"))
      window.setTimeout(() => unsubscribe(), 10 * 60 * 1000)
    } catch (error) { setRunning(false); setStatus(error instanceof Error ? error.message : "Mission dispatch failed") }
  }
  async function applyProposal() {
    if (!proposal) return
    setStatus("APPLYING")
    try {
      for (const change of proposal.changes) await saveProjectFile({ projectId: PROJECT_ID, path: change.path, content: change.content })
      setProposal(null); await refresh()
      setTabs(current => current.map(tab => { const change = proposal.changes.find(item => item.path === tab.path); return change ? { ...tab, content: change.content, savedContent: change.content } : tab }))
      setStatus("CHANGES APPLIED"); log(`Approved ${proposal.changes.length} file change(s)`)
    } catch (error) { setStatus(error instanceof Error ? error.message : "Apply failed") }
  }

  const eventCount = agentEvents.length
  const telemetry = {
    latitude: (50.8466 + Math.sin(eventCount + 1) * 0.0009).toFixed(4),
    longitude: (5.6883 + Math.cos(eventCount + 2) * 0.0011).toFixed(4),
    altitude: Math.round(118 + eventCount * 7),
    flux: (0.18 + Math.min(eventCount, 8) * 0.07).toFixed(2),
    bandwidth: 86 + (eventCount % 12),
    temp: 31 + (eventCount % 8),
    latency: 8 + (eventCount % 9)
  }

  return (
    <main className="hud-console-shell">
      <div className="hud-noise" />
      <header className="hud-topbar"><div className="hud-brand"><span className="hud-mark"><Bot size={15}/></span><div><b>THE HOUSE OF CODING</b><small>AGENT COMMAND NETWORK // NODE 01</small></div></div><div className="hud-top-status"><span className="hud-live-dot"/> SYSTEM {status} <button onClick={() => void refresh()}><RefreshCw size={13} className={refreshing ? "animate-spin" : ""}/></button></div></header>

      <div className="hud-frame">
        <aside className="hud-wing hud-wing-left">
          <div className="hud-wing-title">SYSTEM DATA <span>SYS_VER 4.81</span></div>
          <div className="hud-readout"><span>ACTIVE TARGET</span><strong>{nameOf(selectedFile || "NO TARGET")}</strong><small>{selectedFile || "Select a file from workspace"}</small></div>
          <div className="hud-log"><b>TELEMETRY LOG</b>{(agentEvents.length ? agentEvents.slice(-7) : activity).map((item, i) => <div key={i}><i>{String(i + 1).padStart(2,"0")}</i><span>{typeof item === "string" ? item : `${item.stage.toUpperCase()} · ${item.message}`}</span></div>)}</div>
          <div className="hud-metrics"><Metric label="ENCRYPTION" value="AES-256"/><Metric label="BUFFER TEMP" value={`${telemetry.temp}°C`}/><Metric label="QUANTUM FLUX" value={telemetry.flux}/><Metric label="NEURAL BW" value={`${telemetry.bandwidth}%`}/></div>
          <div className="hud-control-row"><button onClick={() => setSearch("")}>SYS</button><button onClick={() => setSearch(".tsx")}>CROSS</button><button onClick={() => setSearch("api")}>GRID</button></div>
          <div className="hud-status-block"><span>NETWORK STATUS</span><strong><i/> OPERATIONAL</strong><small>SESSION {session?.id ? session.id.slice(0, 12) : "STANDBY"}</small></div>
        </aside>

        <section className="hud-core">
          <div className="hud-core-label"><span>AGENT ORCHESTRATION</span><strong>{session?.status?.toUpperCase() || "STANDBY"}</strong></div>
          <svg className="hud-radar" viewBox="0 0 600 600" aria-label="Agent orchestration HUD">
            <defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            <g fill="none" stroke="currentColor" filter="url(#glow)"><rect x="75" y="185" width="450" height="230" rx="115" strokeWidth="1"/><rect x="96" y="206" width="408" height="188" rx="94" strokeWidth="1" strokeDasharray="3 9"/><ellipse cx="300" cy="300" rx="190" ry="94" strokeWidth="1" strokeDasharray="2 12"/><circle cx="300" cy="300" r="112" strokeWidth="1" strokeDasharray="5 8"/><circle cx="300" cy="300" r="62" strokeWidth="2"/><path d="M92 300H508M300 195V405M170 220L430 380M170 380L430 220" strokeWidth="1" strokeDasharray="6 8"/><path d="M260 300h80M300 260v80" strokeWidth="2"/><path d="M105 240h34M105 360h34M461 240h34M461 360h34" strokeWidth="3"/></g>
            <g className="hud-core-pulse"><circle cx="300" cy="300" r="20" fill="currentColor" opacity=".12"/><circle cx="300" cy="300" r="8" fill="currentColor"/></g>
            <text x="300" y="142" textAnchor="middle" className="hud-svg-text">TARGET // {language.toUpperCase()}</text><text x="300" y="470" textAnchor="middle" className="hud-svg-text">MISSION // {running ? "LIVE" : "READY"}</text>
          </svg>
          <div className="hud-center-coords"><span>LAT {telemetry.latitude}</span><span>LONG {telemetry.longitude}</span><span>ALT {telemetry.altitude} M</span></div>
          <div className="hud-core-actions"><button onClick={() => void execute()} disabled={running || !selectedFile}><Play size={12}/> EXECUTE</button><button onClick={() => void dispatchMission()} disabled={running || !selectedFile}><Zap size={12}/> AUTONOMOUS</button></div>
        </section>

        <aside className="hud-wing hud-wing-right">
          <div className="hud-wing-title">MISSION CONTROL <span>SECTOR 08</span></div>
          <div className="hud-coord-card"><span>COORDINATES</span><strong>{telemetry.latitude} / {telemetry.longitude}</strong><small>VECTOR 0{eventCount % 9 + 1} · {telemetry.altitude}M</small></div>
          <div className="hud-signal"><span>SIGNAL INTEGRITY</span><div>{[1,2,3,4,5,6].map(n => <i key={n} className={n < 6 - (eventCount % 2) ? "on" : ""}/>)}</div></div>
          <div className="hud-diagnostics"><b>DIAGNOSTICS</b><Diag label="RUNTIME" value={language.toUpperCase()} ok/><Diag label="LATENCY" value={`${telemetry.latency} MS`} ok/><Diag label="SESSION" value={session?.status?.toUpperCase() || "IDLE"} ok={!running}/><Diag label="APPROVAL" value={proposal ? "REQUIRED" : "CLEAR"} ok={!proposal}/></div>
          <div className="hud-matrix"><b>RADAR MATRIX</b><div>{Array.from({length: 36}, (_,i) => <i key={i} className={(i + eventCount) % 7 === 0 ? "hot" : ""}/>)}</div></div>
          <div className="hud-mission-input"><span>MISSION DIRECTIVE</span><textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="ENTER COMMAND..."/><button onClick={() => void dispatchMission()} disabled={running || !selectedFile}><Send size={12}/> DISPATCH</button></div>
        </aside>
      </div>

      <section className="hud-dock">
        <div className="hud-dock-files"><div className="hud-dock-title"><FolderOpen size={12}/> WORKSPACE</div><input value={search} onChange={e => setSearch(e.target.value)} placeholder="FILTER..."/>{filteredFiles.slice(0, 6).map(file => <button key={file.path} className={file.path === selectedFile ? "active" : ""} onClick={() => void openFile(file.path)}><FileCode2 size={11}/>{file.path}</button>)}</div>
        <div className="hud-dock-editor"><div className="hud-dock-title"><Code2 size={12}/> EDITOR <span>{selectedFile || "NO TARGET"}</span></div><textarea value={code} onChange={e => updateCode(e.target.value)} spellCheck={false}/></div>
        <div className="hud-dock-output"><div className="hud-dock-title"><Terminal size={12}/> OUTPUT <span>{status}</span></div><pre>{output || agentEvents.slice(-5).map(e => `[${e.stage.toUpperCase()}] ${e.message}`).join("\n") || "SYSTEM READY // AWAITING DIRECTIVE"}</pre></div>
      </section>

      <div className="hud-fleet-bar"><AgentChip icon={<Code2/>} name="BUILD"/><AgentChip icon={<Bug/>} name="DEBUG"/><AgentChip icon={<FlaskConical/>} name="TEST"/><AgentChip icon={<ShieldCheck/>} name="REVIEW"/><AgentChip icon={<Sparkles/>} name="REFINE"/><AgentChip icon={<Zap/>} name="AUTONOMOUS" active/><span className="hud-fleet-spacer"/><span className="hud-human">HUMAN CONTROL // APPROVAL REQUIRED</span></div>
      <AutonomousControls language={language} filePath={selectedFile} code={code} instruction={prompt} onProposal={value => { setProposal(value); setStatus("AWAITING APPROVAL"); log(`Proposal generated · ${value.changes.length} file(s)`) }} onOutput={value => { setOutput(value); setStatus("RESULT AVAILABLE"); log("Agent returned result") }} onFilesChanged={() => void refresh()} />

      {proposal && <div className="agent-approval-overlay"><div className="agent-approval-modal"><header><div><span>APPROVAL QUEUE</span><strong>Agent proposal requires human review</strong></div><button onClick={() => setProposal(null)}><X size={16}/></button></header><div className="agent-approval-summary">{proposal.summary}</div>{proposal.changes.map(change => <div className="agent-change" key={change.path}><span>{change.path}</span><pre>{change.content.slice(0,3000)}</pre></div>)}<footer><button onClick={() => setProposal(null)}>REJECT</button><button className="approve" onClick={() => void applyProposal()}><CheckCircle2 size={13}/> APPROVE & APPLY</button></footer></div></div>}
    </main>
  )
}

function Metric({label,value}:{label:string,value:string}) { return <div className="hud-metric"><span>{label}</span><strong>{value}</strong></div> }
function Diag({label,value,ok}:{label:string,value:string,ok:boolean}) { return <div className="hud-diag"><span>{label}</span><strong>{value}</strong><i className={ok ? "ok" : "warn"}/></div> }
function AgentChip({icon,name,active}:{icon:React.ReactNode,name:string,active?:boolean}) { return <div className={`hud-agent-chip ${active ? "active" : ""}`}>{icon}<span>{name}</span></div> }
