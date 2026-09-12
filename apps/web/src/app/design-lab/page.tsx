"use client"

import { useState } from "react"
import {
  Activity,
  Bot,
  Box,
  BrainCircuit,
  Bug,
  ChevronRight,
  Code2,
  Cpu,
  FileCode2,
  GitBranch,
  Layers3,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  TestTube2,
  Workflow,
  X
} from "lucide-react"

const designs = [
  { id: "mission", label: "Mission Control", eyebrow: "01", description: "Agent orchestration first" },
  { id: "industrial", label: "Industrial Workbench", eyebrow: "02", description: "Dense engineering console" },
  { id: "obsidian", label: "Obsidian Studio", eyebrow: "03", description: "Premium editor-first" },
  { id: "command", label: "Command OS", eyebrow: "04", description: "Coding as an operating system" }
] as const

type DesignId = typeof designs[number]["id"]

function MissionControl() {
  return (
    <div className="hoc-design hoc-mission">
      <aside className="hoc-rail">
        <div className="hoc-mark"><BrainCircuit size={19} /></div>
        <button className="active"><Layers3 size={17} /></button>
        <button><Workflow size={17} /></button>
        <button><Terminal size={17} /></button>
        <button><Bug size={17} /></button>
        <button><TestTube2 size={17} /></button>
      </aside>
      <section className="hoc-mission-main">
        <header className="hoc-topbar">
          <div><span className="eyebrow">HOUSE / WORKSPACE</span><strong>the-house-of-coding</strong></div>
          <div className="live"><span /> SYSTEM ONLINE</div>
        </header>
        <div className="hoc-command-grid">
          <section className="hero-panel">
            <div className="hero-kicker"><Sparkles size={14} /> AUTONOMOUS ENGINE</div>
            <h1>Build. Run. Repair.<br /><span>Let the House think.</span></h1>
            <p>The coding environment is no longer the center. The mission is.</p>
            <div className="mission-actions"><button className="primary"><Play size={15} /> Start mission</button><button><Terminal size={15} /> Open terminal</button></div>
          </section>
          <section className="agent-map">
            <div className="panel-head"><span>AGENT NETWORK</span><span>6 ACTIVE</span></div>
            <div className="agent-node root"><Bot size={17} /><div><b>House Orchestrator</b><small>coordinating workspace</small></div><i>RUNNING</i></div>
            {[["Coder","generating patch"],["Debugger","watching stderr"],["Tester","2 checks queued"],["Reviewer","idle"]].map(([name,status], i) => <div className="agent-node" key={name}><span className={`node-dot n${i}`} /><div><b>{name}</b><small>{status}</small></div><ChevronRight size={14} /></div>)}
          </section>
          <section className="timeline-panel">
            <div className="panel-head"><span>MISSION TIMELINE</span><span>LIVE</span></div>
            <div className="timeline"><div><b>09:42</b><span>Generated patch for page.tsx</span></div><div><b>09:43</b><span>TypeScript execution passed</span></div><div><b>09:43</b><span>3 integration tests queued</span></div><div><b>09:44</b><span>Reviewer waiting for final diff</span></div></div>
          </section>
          <section className="workspace-panel">
            <div className="panel-head"><span>WORKSPACE</span><span>main · clean</span></div>
            <div className="workspace-file active"><FileCode2 size={15} /><span>page.tsx</span><em>modified</em></div>
            <div className="workspace-file"><FileCode2 size={15} /><span>globals.css</span></div>
            <div className="workspace-file"><FileCode2 size={15} /><span>api.ts</span></div>
            <div className="workspace-file"><GitBranch size={15} /><span>3 commits ahead</span></div>
          </section>
        </div>
      </section>
    </div>
  )
}

function IndustrialWorkbench() {
  return (
    <div className="hoc-design hoc-industrial">
      <header className="industrial-top"><div className="machine-id"><span className="status-lamp" /> HOC // ENGINEERING CONSOLE</div><div>WORKSPACE <b>HOUSE</b></div><div>CPU 21% &nbsp; MEM 4.2GB &nbsp; BUILD 842</div></header>
      <aside className="industrial-left"><div className="instrument-title">PROJECT TREE</div><div className="machine-tree"><b>HOUSE</b><span>▾ apps</span><span>▾ web</span><strong>▸ page.tsx</strong><span>▸ globals.css</span><span>▸ api.ts</span><span>▾ core</span><span>▾ agents</span><span>▸ coder.ts</span><span>▸ debugger.ts</span></div><div className="instrument-box"><small>RUNTIME</small><b>NODE 24.14</b><span>READY</span></div></aside>
      <main className="industrial-main"><div className="instrument-tabs"><span className="selected">page.tsx</span><span>globals.css</span><span>api.ts</span><button><Search size={14} /> FIND</button></div><div className="code-instrument"><div className="code-lines">{Array.from({ length: 18 }, (_, i) => <span key={i}>{String(i + 1).padStart(2, "0")}</span>)}</div><pre><code><em>import</em> {'{'} <b>useState</b> {'}'} <em>from</em> <u>"react"</u>{"\n\n"}<em>export default function</em> <b>Home</b>() {'{'}{"\n  "}<em>const</em> [mission, setMission] = useState(<u>"idle"</u>){"\n\n  "}<em>return</em> (<div className="code-ui">MISSION CONTROL</div>){"\n}"}</code></pre></div><footer className="industrial-status"><span><Activity size={13} /> EXECUTION 00:01.42</span><span><ShieldCheck size={13} /> POLICY GATE PASSED</span><span><TestTube2 size={13} /> TESTS 18 / 18</span></footer></main>
      <aside className="industrial-right"><div className="instrument-title">CONTROL</div><button className="big-run"><Play size={18} /> EXECUTE</button><div className="dial"><span>AGENT LOAD</span><strong>64%</strong><div><i style={{ width: "64%" }} /></div></div><div className="control-row"><span>CODER</span><b>ONLINE</b></div><div className="control-row"><span>DEBUGGER</span><b>WATCHING</b></div><div className="control-row"><span>TESTER</span><b>READY</b></div><div className="terminal-mini"><span>$ hoc run --agent</span><p>Execution started...<br />No errors detected.</p></div></aside>
    </div>
  )
}

function ObsidianStudio() {
  return (
    <div className="hoc-design hoc-obsidian">
      <header><div className="obs-brand">THE HOUSE <span>OF CODING</span></div><div className="obs-project">house / <b>page.tsx</b></div><button><Play size={15} /> Run</button></header>
      <main><aside className="obs-sidebar"><small>FILES</small><div>⌄ apps</div><div className="indent">⌄ web</div><div className="indent2 active">page.tsx</div><div className="indent2">globals.css</div><div className="indent2">layout.tsx</div><div className="indent">⌄ lib</div><div className="indent2">api.ts</div><hr /><small>TOOLS</small><div><Search size={14} /> Search</div><div><GitBranch size={14} /> Source control</div></aside><section className="obs-editor"><div className="obs-tabs"><span className="active">page.tsx</span><span>globals.css</span></div><div className="obs-code"><div className="obs-gutter">{Array.from({ length: 16 }, (_, i) => <span key={i}>{i + 1}</span>)}</div><pre><span className="kw">export default function</span> <span className="fn">Home</span>() {'{'}{"\n\n  "}<span className="kw">return</span> ({"\n    "}<span className="tag">&lt;Workspace</span> mode=<span className="str">"autonomous"</span><span className="tag"> /&gt;</span>{"\n  )"}{"\n}"}</pre></div></section><aside className="obs-ai"><div className="ai-orb"><Sparkles size={20} /></div><small>HOUSE AI</small><h2>What are we building?</h2><p>Ask the House to inspect, change, run, test or review the workspace.</p><div className="ai-input">Describe a change... <span>↵</span></div><div className="ai-suggestion">Improve the workspace navigation <ChevronRight size={14} /></div><div className="ai-suggestion">Run the full test suite <ChevronRight size={14} /></div></aside></main>
    </div>
  )
}

function CommandOS() {
  return (
    <div className="hoc-design hoc-command">
      <aside className="command-dock"><div className="command-logo">H</div><button className="active"><Box size={17} /></button><button><Code2 size={17} /></button><button><Bot size={17} /></button><button><Cpu size={17} /></button><div className="dock-bottom"><button><Terminal size={17} /></button></div></aside>
      <main><header><div><small>COMMAND OS</small><h2>House</h2></div><div className="command-search"><Search size={14} /> Search anything <kbd>⌘ K</kbd></div><div className="command-user">DS</div></header><section className="command-body"><div className="command-welcome"><small>MONDAY / 12 SEPTEMBER 2026</small><h1>Good evening, Daniel.</h1><p>3 active agents · 2 pending reviews · workspace healthy</p></div><div className="os-grid"><div className="os-card wide"><small>ACTIVE WORK</small><h3>Redesign House of Coding</h3><div className="progress"><i /></div><footer><span>4 agents</span><span>68% complete</span></footer></div><div className="os-card"><small>AGENTS</small><strong className="big-number">06</strong><span className="green">● all systems nominal</span></div><div className="os-card"><small>EXECUTIONS</small><strong className="big-number">42</strong><span>today</span></div><div className="os-card wide activity-card"><small>RECENT ACTIVITY</small>{["Coder generated 14-line patch","Debugger cleared TypeError","Tester completed integration suite"].map((item, i) => <div key={item}><span>{String(i + 1).padStart(2, "0")}</span>{item}<time>{i + 1}m</time></div>)}</div><div className="os-card command-launch"><Sparkles size={18} /><b>Ask the House</b><span>Build, debug, test or review anything.</span><div>Start a command <kbd>↵</kbd></div></div></div></section></main>
    </div>
  )
}

export default function DesignLab() {
  const [active, setActive] = useState<DesignId>("mission")
  const render = active === "mission" ? <MissionControl /> : active === "industrial" ? <IndustrialWorkbench /> : active === "obsidian" ? <ObsidianStudio /> : <CommandOS />

  return (
    <div className="hoc-design-lab">
      <nav className="design-picker">
        <div className="picker-title"><Sparkles size={16} /> DESIGN LAB</div>
        {designs.map(design => <button key={design.id} onClick={() => setActive(design.id)} className={active === design.id ? "active" : ""}><span>{design.eyebrow}</span><div><b>{design.label}</b><small>{design.description}</small></div></button>)}
        <div className="picker-note"><b>Prototype only</b><span>Each direction is implemented as a real UI surface using the House of Coding component language.</span></div>
      </nav>
      <div className="design-preview">{render}</div>
    </div>
  )
}
