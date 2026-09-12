"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bot, Bug, CheckCircle2, Code2, FileCode2, FlaskConical, FolderOpen, GitPullRequest, Play, RefreshCw, RotateCcw, Send, ShieldCheck, Sparkles, Terminal, X, Zap } from "lucide-react"
import { AutonomousControls, type AgentAction } from "../../components/autonomous-controls"
import { executeFile, getLanguages, getProjectFile, getProjectFiles, saveProjectFile, type LanguageRuntime, type WorkspaceFile } from "../../lib/api"

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
      setFiles(fileData.files)
      setLanguages(languageData.languages)
      setStatus("READY")
      log(`Workspace synchronized · ${fileData.files.length} files`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Workspace unavailable")
    } finally { setRefreshing(false) }
  }, [log])

  const openFile = useCallback(async (path: string) => {
    const existing = tabs.find(tab => tab.path === path)
    if (existing) { setSelectedFile(path); return }
    try {
      const result = await getProjectFile(PROJECT_ID, path)
      setTabs(current => [...current, { path, content: result.content, savedContent: result.content }])
      setSelectedFile(path)
      log(`Opened ${nameOf(path)}`)
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to open file") }
  }, [tabs, log])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { if (!selectedFile && files.some(file => file.path === DEFAULT_FILE)) void openFile(DEFAULT_FILE) }, [files, selectedFile, openFile])

  function updateCode(content: string) { setTabs(current => current.map(tab => tab.path === selectedFile ? { ...tab, content } : tab)) }

  async function save() {
    if (!active) return
    setStatus("SAVING")
    await saveProjectFile({ projectId: PROJECT_ID, path: active.path, content: active.content })
    setTabs(current => current.map(tab => tab.path === active.path ? { ...tab, savedContent: tab.content } : tab))
    setStatus("SAVED")
    log(`Committed ${nameOf(active.path)}`)
  }

  async function execute() {
    if (!selectedFile) return
    setRunning(true); setStatus("EXECUTING"); log(`Execution started · ${nameOf(selectedFile)}`)
    try {
      await save()
      const result = await executeFile({ language, filePath: selectedFile })
      setOutput(`EXIT ${result.result.exitCode}\nDURATION ${result.result.durationMs} ms\n\nSTDOUT\n${result.result.stdout || "(none)"}\n\nSTDERR\n${result.result.stderr || "(none)"}`)
      setStatus(result.result.success ? "EXECUTION PASSED" : "EXECUTION FAILED")
      log(result.result.success ? "Execution passed" : "Execution returned a failure")
    } catch (error) { setOutput(error instanceof Error ? error.message : "Execution failed"); setStatus("EXECUTION FAILED") }
    finally { setRunning(false) }
  }

  async function applyProposal() {
    if (!proposal) return
    setStatus("APPLYING")
    try {
      for (const change of proposal.changes) await saveProjectFile({ projectId: PROJECT_ID, path: change.path, content: change.content })
      setProposal(null)
      await refresh()
      if (selectedFile) { setTabs(current => current.map(tab => { const change = proposal.changes.find(item => item.path === tab.path); return change ? { ...tab, content: change.content, savedContent: change.content } : tab })); }
      setStatus("CHANGES APPLIED")
      log(`Approved ${proposal.changes.length} file change(s)`)
    } catch (error) { setStatus(error instanceof Error ? error.message : "Apply failed") }
  }

  return (
    <main className="agent-workspace-shell">
      <header className="agent-workspace-header">
        <div className="agent-brand"><div className="agent-brand-mark"><Bot size={19} /></div><div><span>THE HOUSE OF CODING</span><strong>AGENT WORKSPACE</strong></div></div>
        <div className="agent-header-mission"><span>MISSION</span><strong>{prompt.trim() || "No mission dispatched"}</strong></div>
        <div className="agent-header-status"><i /> {status}<button onClick={() => void refresh()} title="Synchronize workspace"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} /></button></div>
      </header>

      <div className="agent-workspace-grid">
        <aside className="agent-workspace-sidebar">
          <div className="agent-panel-title"><FolderOpen size={13} /> WORKSPACE <span>{files.length}</span></div>
          <input className="agent-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter files..." />
          <div className="agent-file-tree">
            {filteredFiles.slice(0, 120).map(file => <button key={file.path} onClick={() => void openFile(file.path)} className={file.path === selectedFile ? "active" : ""}><FileCode2 size={12} /><span>{file.path}</span></button>)}
          </div>
          <div className="agent-sidebar-footer"><span>RUNTIME</span><strong>LOCAL EXECUTION</strong><small>Human approval required for proposed changes.</small></div>
        </aside>

        <section className="agent-workspace-center">
          <div className="agent-mission-bar"><div><span>ACTIVE TARGET</span><strong>{selectedFile || "Select a workspace file"}</strong></div><div className="agent-target-meta">{language.toUpperCase()} · {active && active.content !== active.savedContent ? "MODIFIED" : "SYNCHRONIZED"}</div><button onClick={() => void execute()} disabled={running || !selectedFile}><Play size={13} /> {running ? "RUNNING" : "EXECUTE"}</button></div>
          <div className="agent-tabs">{tabs.map(tab => <button key={tab.path} onClick={() => setSelectedFile(tab.path)} className={tab.path === selectedFile ? "active" : ""}>{nameOf(tab.path)}{tab.content !== tab.savedContent && <i />}</button>)}</div>
          <div className="agent-editor"><div className="agent-gutter">{code.split("\n").map((_, index) => <span key={index}>{index + 1}</span>)}</div><textarea value={code} onChange={event => updateCode(event.target.value)} spellCheck={false} /></div>
          <div className="agent-output"><div className="agent-output-title"><Terminal size={13} /> EXECUTION / AGENT STREAM <span>{status}</span></div><pre>{output || "No active output. Dispatch a mission or execute the target."}</pre></div>
        </section>

        <aside className="agent-workspace-right">
          <section className="agent-mission-card"><div className="agent-panel-title"><Sparkles size={13} /> MISSION CONTROL</div><textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Tell the agent what to build, debug, test, review or refine..." /><button className="mission-dispatch" onClick={() => { setStatus("MISSION READY"); log(`Mission staged · ${prompt.trim() || "inspect workspace"}`) }}><Send size={13} /> STAGE MISSION</button></section>

          <section className="agent-fleet-card"><div className="agent-panel-title"><GitPullRequest size={13} /> AGENT FLEET <span>6</span></div><div className="agent-fleet-grid-mini"><div><Code2 /><b>BUILD</b><small>propose</small></div><div><Bug /><b>DEBUG</b><small>trace</small></div><div><FlaskConical /><b>TEST</b><small>verify</small></div><div><ShieldCheck /><b>REVIEW</b><small>audit</small></div><div><Sparkles /><b>REFINE</b><small>improve</small></div><div className="auto"><Zap /><b>AUTONOMOUS</b><small>full loop</small></div></div></section>

          <AutonomousControls language={language} filePath={selectedFile} code={code} instruction={prompt} onProposal={proposalValue => { setProposal(proposalValue); setStatus("AWAITING APPROVAL"); log(`Proposal generated · ${proposalValue.changes.length} file(s)`) }} onOutput={value => { setOutput(value); setStatus("RESULT AVAILABLE"); log("Agent returned result") }} onFilesChanged={() => void refresh()} />

          <section className="agent-activity-card"><div className="agent-panel-title"><Terminal size={13} /> LIVE ACTIVITY</div>{activity.map((item, index) => <div className="agent-activity-row" key={`${item}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{item}</div>)}</section>
        </aside>
      </div>

      {proposal && <div className="agent-approval-overlay"><div className="agent-approval-modal"><header><div><span>APPROVAL QUEUE</span><strong>Agent proposal requires human review</strong></div><button onClick={() => setProposal(null)}><X size={16} /></button></header><div className="agent-approval-summary">{proposal.summary}</div>{proposal.changes.map(change => <div className="agent-change" key={change.path}><span>{change.path}</span><pre>{change.content.slice(0, 3000)}</pre></div>)}<footer><button onClick={() => setProposal(null)}>REJECT</button><button className="approve" onClick={() => void applyProposal()}><CheckCircle2 size={13} /> APPROVE & APPLY</button></footer></div></div>}
    </main>
  )
}
