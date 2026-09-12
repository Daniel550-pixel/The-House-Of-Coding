"use client"

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  Volume2,
  VolumeX,
  Radio,
  Crosshair,
  Zap,
  Activity,
  Compass,
  Terminal as TerminalIcon,
  Sliders
} from "lucide-react"

export interface HudTelemetry {
  sysTemp: string
  coreLoad: string
  linkFreq: string
  latency: string
  workspaceFilesCount: number
  activeProjectName: string
  recentLogs?: string[]
}

export type HudMode = "TARGETING" | "DIAGNOSTICS" | "DEFENSE" | "STEALTH"

interface Target {
  id: string
  name: string
  x: number // normalized -1 to 1
  y: number // normalized -1 to 1
  dist: number
  bearing: number
  speed: string
  threat: "LOW" | "MED" | "HIGH"
  detected: boolean
  lastSwept: number
}

const INITIAL_TARGETS: Target[] = [
  { id: "tgt-01", name: "TGT-01", x: 0.35, y: -0.25, dist: 4.8, bearing: 54, speed: "Mach 2.1", threat: "MED", detected: true, lastSwept: 0 },
  { id: "tgt-02", name: "TGT-02", x: -0.5, y: 0.4, dist: 7.2, bearing: 215, speed: "Mach 1.4", threat: "LOW", detected: true, lastSwept: 0 },
  { id: "tgt-03", name: "TGT-03", x: 0.2, y: 0.65, dist: 6.1, bearing: 110, speed: "Mach 3.2", threat: "HIGH", detected: true, lastSwept: 0 },
  { id: "tgt-04", name: "TGT-04", x: -0.65, y: -0.55, dist: 9.0, bearing: 305, speed: "Subsonic", threat: "LOW", detected: true, lastSwept: 0 },
]

export function FuturisticHud({
  telemetry,
  soundEnabled,
  onToggleSound,
  extraLogs = []
}: {
  telemetry: HudTelemetry
  soundEnabled: boolean
  onToggleSound: () => void
  extraLogs?: string[]
}) {
  const [hudMode, setHudMode] = useState<HudMode>("TARGETING")
  const [sweepSpeed, setSweepSpeed] = useState<number>(1.2)
  const [radarZoom, setRadarZoom] = useState<number>(1.5)
  const [targetLocked, setTargetLocked] = useState<boolean>(false)
  const [selectedTarget, setSelectedTarget] = useState<string>("tgt-01")
  const [activePingRadius, setActivePingRadius] = useState<number | null>(null)
  const [coordinates, setCoordinates] = useState({ x: "+1042.88", y: "-0428.14", z: "+8920.00" })
  const [fluxPercent, setFluxPercent] = useState(78)
  const [synapsePercent, setSynapsePercent] = useState(92)
  const [thermalPercent, setThermalPercent] = useState(34)
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "[SYS_BOOT] KERNEL INITIALIZED // ARCH: x86_64_CYBER",
    "[NET_LINK] UPLINK ESTABLISHED 10.42.0.1 (LOW LATENCY)",
    "[SEC_CHK] CIPHER SUITE ROTATION COMPLETE: AES-256-GCM",
    "[RADAR] SCANNER ACTIVE // 4 SIGNATURES DETECTED IN SECTOR",
    "[ORCHESTRATOR] AI MATRIX RUNTIME STANDBY"
  ])

  const combinedLogs = useMemo(() => {
    const all = [...systemLogs, ...(extraLogs ?? [])]
    return all.slice(-35)
  }, [systemLogs, extraLogs])

  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const terminalLogsRef = useRef<HTMLDivElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Web Audio Synthesizer
  const playBeep = useCallback((freq = 800, type: OscillatorType = "sine", duration = 0.08) => {
    if (!soundEnabled) return
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioCtxRef.current = new AudioContextClass()
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume()
      }
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      // Audio context might be restricted before user gesture
    }
  }, [soundEnabled])

  const playPingSFX = useCallback(() => {
    if (!soundEnabled) return
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioCtxRef.current = new AudioContextClass()
      }
      if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume()
      }
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(1400, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.8)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.8)
    } catch {
      // ignore
    }
  }, [soundEnabled])

  const playLockSFX = useCallback(() => {
    if (!soundEnabled) return
    playBeep(1200, "sawtooth", 0.15)
    setTimeout(() => playBeep(1600, "sawtooth", 0.2), 100)
  }, [soundEnabled, playBeep])

  // Auto-scroll terminal log
  useEffect(() => {
    if (terminalLogsRef.current) {
      terminalLogsRef.current.scrollTop = terminalLogsRef.current.scrollHeight
    }
  }, [combinedLogs])

  // Periodic coordinates and flux micro-variations
  useEffect(() => {
    const timer = setInterval(() => {
      setCoordinates({
        x: (1042 + Math.sin(Date.now() / 1500) * 1.5).toFixed(2),
        y: (-428 + Math.cos(Date.now() / 2000) * 1.2).toFixed(2),
        z: (8920 + Math.sin(Date.now() / 3000) * 4.0).toFixed(2),
      })
      setFluxPercent(prev => Math.min(95, Math.max(65, Math.round(prev + (Math.random() * 4 - 2)))))
      setSynapsePercent(prev => Math.min(98, Math.max(82, Math.round(prev + (Math.random() * 2 - 1)))))
      setThermalPercent(prev => Math.min(48, Math.max(26, Math.round(prev + (Math.random() * 3 - 1.5)))))
    }, 1200)
    return () => clearInterval(timer)
  }, [])

  // Active Ping Sonar Animation
  const emitActivePing = () => {
    playPingSFX()
    setActivePingRadius(0)
    setSystemLogs(prev => [...prev.slice(-25), `[RADAR] ACTIVE SONAR PING EMITTED @ ${new Date().toISOString().substring(11, 19)} UTC`])
  }

  // Toggle Target Lock
  const toggleTargetLock = () => {
    const next = !targetLocked
    setTargetLocked(next)
    if (next) {
      playLockSFX()
      setSystemLogs(prev => [...prev.slice(-25), `[LOCK] ENGAGED: TARGET [${selectedTarget.toUpperCase()}] CONFIRMED`])
    } else {
      playBeep(450, "sine", 0.1)
      setSystemLogs(prev => [...prev.slice(-25), "[LOCK] DISENGAGED // RETURNING TO AUTO-SCAN"])
    }
  }

  // Radar Canvas Render Loop
  useEffect(() => {
    let animId: number
    let angle = 0
    const canvas = radarCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
    }
    handleResize()
    window.addEventListener("resize", handleResize)

    let localPing = activePingRadius

    const render = () => {
      const width = canvas.width
      const height = canvas.height
      const cx = width / 2
      const cy = height / 2
      const radius = Math.min(cx, cy) * 0.88

      ctx.clearRect(0, 0, width, height)

      // Background subtle grid
      ctx.strokeStyle = "rgba(0, 243, 255, 0.08)"
      ctx.lineWidth = 1
      const step = 40
      for (let x = 0; x < width; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Radar rings
      const rings = [0.25, 0.5, 0.75, 1.0]
      rings.forEach((r, idx) => {
        ctx.beginPath()
        ctx.arc(cx, cy, radius * r, 0, Math.PI * 2)
        ctx.strokeStyle = idx === 3 ? "rgba(0, 243, 255, 0.45)" : "rgba(0, 243, 255, 0.2)"
        ctx.lineWidth = idx === 3 ? 1.5 : 1
        ctx.stroke()

        // Distance text on outer ring
        ctx.fillStyle = "rgba(0, 243, 255, 0.4)"
        ctx.font = `${Math.max(10, Math.round(width * 0.018))}px 'Share Tech Mono', monospace`
        ctx.fillText(`${(r * 10 * (1 / radarZoom)).toFixed(1)} NM`, cx + 6, cy - radius * r + 12)
      })

      // Crosshairs
      ctx.strokeStyle = "rgba(0, 243, 255, 0.3)"
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(cx - radius, cy)
      ctx.lineTo(cx + radius, cy)
      ctx.moveTo(cx, cy - radius)
      ctx.lineTo(cx, cy + radius)
      ctx.stroke()
      ctx.setLineDash([])

      // Degree tick marks on outer edge
      const ticks = 36
      for (let i = 0; i < ticks; i++) {
        const rad = (i * (Math.PI * 2)) / ticks
        const isMajor = i % 9 === 0
        const len = isMajor ? 12 : 6
        const x1 = cx + Math.cos(rad) * radius
        const y1 = cy + Math.sin(rad) * radius
        const x2 = cx + Math.cos(rad) * (radius - len)
        const y2 = cy + Math.sin(rad) * (radius - len)

        ctx.strokeStyle = isMajor ? "#00f3ff" : "rgba(0, 243, 255, 0.35)"
        ctx.lineWidth = isMajor ? 1.5 : 1
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }

      // Sweep Beam & Gradient Trail
      angle = (angle + 0.015 * sweepSpeed) % (Math.PI * 2)

      const trailAngle = Math.PI / 3
      const trailGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      trailGrad.addColorStop(0, "rgba(0, 243, 255, 0.35)")
      trailGrad.addColorStop(1, "rgba(0, 243, 255, 0.02)")

      ctx.save()
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, radius, angle - trailAngle, angle)
      ctx.closePath()
      ctx.fillStyle = trailGrad
      ctx.fill()
      ctx.restore()

      // Bright sweep line
      ctx.strokeStyle = "#00f3ff"
      ctx.lineWidth = 2
      ctx.shadowColor = "#00f3ff"
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
      ctx.stroke()
      ctx.shadowBlur = 0

      // Active Sonar Ping wave
      if (localPing !== null && localPing < radius * 1.1) {
        localPing += 3.5
        ctx.beginPath()
        ctx.arc(cx, cy, localPing, 0, Math.PI * 2)
        const alpha = Math.max(0, 1 - localPing / (radius * 1.1))
        ctx.strokeStyle = `rgba(0, 243, 255, ${alpha})`
        ctx.lineWidth = 3
        ctx.stroke()
      }

      // Render Targets
      INITIAL_TARGETS.forEach(target => {
        const tx = cx + target.x * radius * (radarZoom / 1.5)
        const ty = cy + target.y * radius * (radarZoom / 1.5)

        // Calculate angle to target
        const targetAngle = (Math.atan2(ty - cy, tx - cx) + Math.PI * 2) % (Math.PI * 2)
        const diff = Math.abs(angle - targetAngle)
        const isSwept = diff < 0.2 || diff > Math.PI * 2 - 0.2

        const isLocked = targetLocked && selectedTarget === target.id

        // Target blip marker
        ctx.beginPath()
        ctx.arc(tx, ty, isLocked ? 6 : 4, 0, Math.PI * 2)
        ctx.fillStyle = isLocked ? "#ff3366" : isSwept ? "#00f3ff" : "rgba(0, 243, 255, 0.75)"
        ctx.shadowColor = isLocked ? "#ff3366" : "#00f3ff"
        ctx.shadowBlur = isLocked ? 14 : isSwept ? 12 : 4
        ctx.fill()
        ctx.shadowBlur = 0

        // Target label
        ctx.font = `${Math.max(9, Math.round(width * 0.016))}px 'Share Tech Mono', monospace`
        ctx.fillStyle = isLocked ? "#ff6688" : "rgba(0, 243, 255, 0.85)"
        ctx.fillText(`${target.name} [${target.threat}]`, tx + 9, ty - 6)

        // If locked: draw animated targeting bracket around this target
        if (isLocked) {
          const bSize = 14
          ctx.strokeStyle = "#ff3366"
          ctx.lineWidth = 1.5
          // 4 corner brackets
          ctx.strokeRect(tx - bSize, ty - bSize, bSize * 2, bSize * 2)
          // Lock connecting line to center
          ctx.setLineDash([2, 4])
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(tx, ty)
          ctx.stroke()
          ctx.setLineDash([])
        }
      })

      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", handleResize)
    }
  }, [sweepSpeed, radarZoom, targetLocked, selectedTarget, activePingRadius])

  // Oscilloscope Sine Wave Canvas Loop
  useEffect(() => {
    let waveAnimId: number
    let phase = 0
    const canvas = waveCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
    }
    handleResize()
    window.addEventListener("resize", handleResize)

    const drawWave = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      // Center baseline
      ctx.strokeStyle = "rgba(0, 243, 255, 0.15)"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()

      // Primary sine wave
      ctx.strokeStyle = "#00f3ff"
      ctx.lineWidth = 2
      ctx.shadowColor = "#00f3ff"
      ctx.shadowBlur = 6
      ctx.beginPath()

      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * 0.04 + phase) * (h * 0.35) * Math.sin(x * 0.005 + phase * 0.5)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      // Harmonic faint secondary wave
      ctx.strokeStyle = "rgba(0, 243, 255, 0.3)"
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.cos(x * 0.08 - phase * 1.5) * (h * 0.2)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      phase += 0.06
      waveAnimId = requestAnimationFrame(drawWave)
    }

    drawWave()

    return () => {
      cancelAnimationFrame(waveAnimId)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <div className="relative flex flex-col w-full h-full min-h-[640px] select-none text-[#00f3ff] font-tech-mono overflow-hidden">
      {/* SCANLINE OVERLAY */}
      <div className="absolute inset-0 scanline-bg pointer-events-none z-30 opacity-60" />

      {/* TOP HUD STATUS BAR */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/30 bg-[#03101a]/95 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-500" />
          </span>
          <div className="flex flex-col">
            <span className="font-orbitron text-xs sm:text-sm font-bold tracking-widest text-glow">
              CYBER-OS // NEXUS-HUD <span className="text-white/60 font-normal">v4.9.2</span>
            </span>
            <span className="text-[10px] text-cyan-400/60 font-mono tracking-wider">
              AIOS ACTIVE NODE : [{telemetry.activeProjectName.toUpperCase()}]
            </span>
          </div>
        </div>

        {/* HUD Mode Switcher */}
        <div className="flex items-center border border-cyan-500/30 bg-[#020d17] p-0.5 box-glow text-[10px] font-orbitron">
          {(["TARGETING", "DIAGNOSTICS", "DEFENSE", "STEALTH"] as HudMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => {
                setHudMode(mode)
                playBeep(800, "sine", 0.04)
                setSystemLogs(prev => [...prev.slice(-25), `[MODE] SWITCHED TO ${mode}`])
              }}
              className={`px-2 py-0.5 tracking-wider transition ${
                hudMode === mode
                  ? "bg-cyan-500/30 border border-cyan-400 text-white font-bold box-glow"
                  : "text-cyan-400/60 hover:text-cyan-200"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Live Telemetry Chips */}
        <div className="hidden lg:flex items-center gap-5 text-xs font-mono">
          <div className="flex items-center gap-1.5 border-r border-cyan-500/20 pr-4">
            <span className="text-cyan-400/60">SYS TEMP:</span>
            <span className="font-bold text-white tracking-wider">{telemetry.sysTemp}</span>
          </div>
          <div className="flex items-center gap-1.5 border-r border-cyan-500/20 pr-4">
            <span className="text-cyan-400/60">CORE LOAD:</span>
            <span className="font-bold text-cyan-300">{telemetry.coreLoad}</span>
          </div>
          <div className="flex items-center gap-1.5 border-r border-cyan-500/20 pr-4">
            <span className="text-cyan-400/60">LINK FREQ:</span>
            <span className="font-bold text-white">{telemetry.linkFreq}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400/60">LATENCY:</span>
            <span className="font-bold text-emerald-400">{telemetry.latency}</span>
          </div>
        </div>

        {/* Audio Toggle & Clock */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              onToggleSound()
              playBeep(900, "sine", 0.05)
            }}
            title={soundEnabled ? "Audio Synthesizer Enabled" : "Audio Synthesizer Muted"}
            className={`flex items-center gap-1.5 border px-2.5 py-1 text-xs font-orbitron transition ${
              soundEnabled
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 box-glow"
                : "border-cyan-500/30 bg-transparent text-cyan-500/50 hover:text-cyan-300"
            }`}
          >
            {soundEnabled ? <Volume2 size={13} className="animate-pulse" /> : <VolumeX size={13} />}
            <span className="text-[10px] tracking-widest">{soundEnabled ? "AUDIO ON" : "MUTED"}</span>
          </button>

          <div className="border border-cyan-500/30 bg-[#020d17] px-3 py-1 text-xs font-mono text-cyan-300 font-bold tracking-widest box-glow">
            {new Date().toISOString().substring(11, 19)} UTC
          </div>
        </div>
      </header>

      {/* 3-PANEL HUD COCKPIT LAYOUT */}
      <div className="relative z-10 grid flex-1 grid-cols-1 md:grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* ==================================================================== */}
        {/* LEFT PANEL: DIAGNOSTICS, GAUGES, TERMINAL LOG, SCAN CONTROLS         */}
        {/* ==================================================================== */}
        <div className="md:col-span-3 flex flex-col gap-3 overflow-hidden">
          {/* Diagnostics Box */}
          <div className="hud-panel p-3.5 flex flex-col gap-3 box-glow">
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
              <span className="font-orbitron text-xs font-bold tracking-widest text-glow flex items-center gap-1.5">
                <Activity size={13} />
                DIAGNOSTICS
              </span>
              <span className="border border-cyan-500/40 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300">
                SYS_LOG
              </span>
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="hud-card p-2">
                <div className="text-cyan-400/60 uppercase">SYSTEM STATUS</div>
                <div className="font-bold text-white flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </div>
              </div>
              <div className="hud-card p-2">
                <div className="text-cyan-400/60 uppercase">ENCRYPTION</div>
                <div className="font-bold text-cyan-300 mt-0.5">256-BIT AES</div>
              </div>
              <div className="hud-card p-2">
                <div className="text-cyan-400/60 uppercase">PROJECT FILES</div>
                <div className="font-bold text-white mt-0.5">{telemetry.workspaceFilesCount} ASSETS</div>
              </div>
              <div className="hud-card p-2">
                <div className="text-cyan-400/60 uppercase">SHIELD MATRIX</div>
                <div className="font-bold text-cyan-300 mt-0.5">ACTIVE 100%</div>
              </div>
            </div>

            {/* Progress Bars */}
            <div className="flex flex-col gap-2 pt-1">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-cyan-400/70">QUANTUM FLUX</span>
                  <span className="font-bold text-cyan-300">{fluxPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-cyan-950/60 border border-cyan-500/30 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 box-glow transition-all duration-500"
                    style={{ width: `${fluxPercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-cyan-400/70">NEURAL SYNAPSE</span>
                  <span className="font-bold text-cyan-300">{synapsePercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-cyan-950/60 border border-cyan-500/30 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 box-glow transition-all duration-500"
                    style={{ width: `${synapsePercent}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-cyan-400/70">THERMAL BUFFER</span>
                  <span className="font-bold text-cyan-300">{thermalPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-cyan-950/60 border border-cyan-500/30 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 box-glow transition-all duration-500"
                    style={{ width: `${thermalPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Terminal Log */}
          <div className="hud-panel p-3 flex-1 flex flex-col min-h-[140px] box-glow overflow-hidden">
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-1.5 mb-2">
              <span className="font-orbitron text-xs font-bold tracking-widest text-glow flex items-center gap-1.5">
                <TerminalIcon size={12} />
                LIVE TERMINAL
              </span>
              <span className="text-[9px] text-cyan-400/50 font-mono">AUTOSCROLL</span>
            </div>
            <div
              ref={terminalLogsRef}
              className="flex-1 overflow-y-auto font-mono text-[10px] text-cyan-300/80 space-y-1.5 pr-1 select-text"
            >
              {combinedLogs.map((item, idx) => (
                <div key={idx} className="leading-tight break-all border-b border-cyan-500/10 pb-0.5">
                  <span className="text-cyan-400/40 mr-1">&gt;</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Scan Controls (Sweep Speed & Zoom) */}
          <div className="hud-panel p-3 flex flex-col gap-2.5 box-glow">
            <div className="flex items-center gap-1.5 text-xs font-orbitron font-bold tracking-wider text-glow">
              <Sliders size={12} />
              SCAN CONTROLS
            </div>
            <div className="flex flex-col gap-2 text-[10px]">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-cyan-400/70">SWEEP SPEED</span>
                  <span className="font-bold text-cyan-300">{sweepSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="3.0"
                  step="0.1"
                  value={sweepSpeed}
                  onChange={e => {
                    setSweepSpeed(parseFloat(e.target.value))
                    playBeep(400 + parseFloat(e.target.value) * 150, "sine", 0.02)
                  }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-cyan-400/70">RADAR ZOOM</span>
                  <span className="font-bold text-cyan-300">{radarZoom.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="3.0"
                  step="0.1"
                  value={radarZoom}
                  onChange={e => {
                    setRadarZoom(parseFloat(e.target.value))
                    playBeep(500 + parseFloat(e.target.value) * 100, "sine", 0.02)
                  }}
                  className="w-full cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* CENTER PANEL: INTERACTIVE RETICLE & RADAR STADIUM DISPLAY            */}
        {/* ==================================================================== */}
        <div className="md:col-span-6 flex flex-col gap-2 relative">
          {/* Top Mode Selector Bar */}
          <div className="flex items-center justify-between border border-cyan-500/30 bg-[#03101a]/90 p-1.5 box-glow">
            <div className="flex items-center gap-1 w-full justify-between">
              {(["TARGETING", "DIAGNOSTICS", "DEFENSE", "STEALTH"] as HudMode[]).map(mode => {
                const active = hudMode === mode
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      setHudMode(mode)
                      playBeep(active ? 700 : 950, "sine", 0.06)
                      setSystemLogs(prev => [...prev.slice(-25), `[MODE] SWITCHED TO -> ${mode}`])
                    }}
                    className={`flex-1 px-2 py-1 text-center font-orbitron text-[10px] tracking-wider transition ${
                      active
                        ? "border border-cyan-400 bg-cyan-500/30 text-white font-bold box-glow"
                        : "border border-transparent text-cyan-400/60 hover:border-cyan-500/30 hover:text-cyan-300"
                    }`}
                  >
                    {mode}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main Reticle / Radar Stadium Canvas Box */}
          <div className="hud-panel relative flex-1 min-h-[380px] flex items-center justify-center p-2 box-glow overflow-hidden">
            {/* SVG Concentric Rotating Reticle Rings Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
              {/* Outer Rotating Dashed Ring */}
              <svg className="w-[82%] h-[82%] spin-cw opacity-35" viewBox="0 0 400 400">
                <circle
                  cx="200"
                  cy="200"
                  r="185"
                  fill="none"
                  stroke="#00f3ff"
                  strokeWidth="1.5"
                  strokeDasharray="14 10"
                />
                <circle
                  cx="200"
                  cy="200"
                  r="165"
                  fill="none"
                  stroke="#00f3ff"
                  strokeWidth="1"
                  strokeDasharray="4 8"
                />
              </svg>

              {/* Inner Counter-Rotating Reticle Ring */}
              <svg className="w-[66%] h-[66%] spin-ccw opacity-45" viewBox="0 0 300 300">
                <circle
                  cx="150"
                  cy="150"
                  r="135"
                  fill="none"
                  stroke="#00f3ff"
                  strokeWidth="1.5"
                  strokeDasharray="25 15"
                />
                <circle
                  cx="150"
                  cy="150"
                  r="105"
                  fill="none"
                  stroke="#00f3ff"
                  strokeWidth="1"
                  strokeDasharray="6 6"
                />
              </svg>

              {/* Center Targeting Reticle Pulse */}
              <div
                className={`w-16 h-16 border rounded-full pulse-slow flex items-center justify-center ${
                  targetLocked ? "border-rose-500 box-glow-red" : "border-cyan-400 box-glow"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${targetLocked ? "bg-rose-500 animate-ping" : "bg-cyan-400"}`}
                />
              </div>
            </div>

            {/* The Interactive Radar Canvas */}
            <canvas
              ref={radarCanvasRef}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = (e.clientX - rect.left) / rect.width
                const clickY = (e.clientY - rect.top) / rect.height
                // Find nearest target
                let closest = INITIAL_TARGETS[0].id
                let minD = 9999
                INITIAL_TARGETS.forEach(t => {
                  const tx = 0.5 + (t.x * (radarZoom / 1.5)) / 2
                  const ty = 0.5 + (t.y * (radarZoom / 1.5)) / 2
                  const d = Math.hypot(clickX - tx, clickY - ty)
                  if (d < minD) {
                    minD = d
                    closest = t.id
                  }
                })
                setSelectedTarget(closest)
                setTargetLocked(true)
                playLockSFX()
                setSystemLogs(prev => [...prev.slice(-25), `[RADAR] CLICK SELECT: ${closest.toUpperCase()} LOCKED`])
              }}
              className="w-full h-full cursor-crosshair relative z-0"
            />

            {/* Radar Overlay Status Footer */}
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between pointer-events-none text-[10px] font-mono z-20">
              <div className="bg-[#020d17]/80 border border-cyan-500/30 px-2 py-0.5">
                MODE: <span className="font-bold text-white">{hudMode}</span>
              </div>
              <div className="bg-[#020d17]/80 border border-cyan-500/30 px-2 py-0.5">
                TARGETS DETECTED: <span className="font-bold text-cyan-300">4 ACTIVE</span>
              </div>
              <div
                className={`border px-2 py-0.5 font-bold ${
                  targetLocked
                    ? "border-rose-500 bg-rose-950/80 text-rose-300 box-glow-red"
                    : "border-cyan-500/30 bg-[#020d17]/80 text-cyan-400"
                }`}
              >
                LOCK: {targetLocked ? `LOCKED [${selectedTarget.toUpperCase()}]` : "SEARCHING"}
              </div>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* RIGHT PANEL: AUX READOUTS, COORDINATES, OSCILLOSCOPE, ACTIONS       */}
        {/* ==================================================================== */}
        <div className="md:col-span-3 flex flex-col gap-3 overflow-hidden">
          {/* Aux Readouts Box */}
          <div className="hud-panel p-3.5 flex flex-col gap-3 box-glow">
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2">
              <span className="font-orbitron text-xs font-bold tracking-widest text-glow flex items-center gap-1.5">
                <Compass size={13} />
                AUX READOUTS
              </span>
              <span className="border border-cyan-500/40 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300">
                SEC_08
              </span>
            </div>

            {/* Target Coordinates */}
            <div className="flex flex-col gap-1.5 text-[11px] font-mono">
              <div className="text-[10px] text-cyan-400/60 uppercase">TARGET COORDINATES</div>
              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="hud-card p-1.5">
                  <div className="text-[8px] text-cyan-400/60">POS X</div>
                  <div className="font-bold text-white text-[10px]">{coordinates.x}</div>
                </div>
                <div className="hud-card p-1.5">
                  <div className="text-[8px] text-cyan-400/60">POS Y</div>
                  <div className="font-bold text-white text-[10px]">{coordinates.y}</div>
                </div>
                <div className="hud-card p-1.5">
                  <div className="text-[8px] text-cyan-400/60">POS Z</div>
                  <div className="font-bold text-white text-[10px]">{coordinates.z}</div>
                </div>
              </div>
            </div>

            {/* Frequency Oscilloscope Wave Canvas */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-cyan-400/70">FREQUENCY WAVE</span>
                <span className="font-bold text-cyan-300 font-mono">58.4 Hz</span>
              </div>
              <div className="h-16 w-full border border-cyan-500/30 bg-[#020b14] overflow-hidden relative">
                <canvas ref={waveCanvasRef} className="w-full h-full" />
              </div>
            </div>

            {/* Bearing, Velocity, Threat Level */}
            <div className="space-y-1 text-[10px] border-t border-cyan-500/20 pt-2 font-mono">
              <div className="flex justify-between">
                <span className="text-cyan-400/60">RADIAL BEARING:</span>
                <span className="font-bold text-white">214.5° SE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyan-400/60">RELATIVE VELOCITY:</span>
                <span className="font-bold text-cyan-300">Mach 3.2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyan-400/60">THREAT LEVEL:</span>
                <span className="font-bold text-emerald-400">LOW / NOMINAL</span>
              </div>
            </div>
          </div>

          {/* Action Command Buttons */}
          <div className="hud-panel p-3 flex flex-col gap-2.5 box-glow">
            <div className="font-orbitron text-xs font-bold tracking-widest text-glow flex items-center gap-1.5 border-b border-cyan-500/30 pb-1.5">
              <Zap size={12} />
              COMMAND ACTIONS
            </div>

            <button
              onClick={emitActivePing}
              className="flex items-center justify-center gap-2 border border-cyan-400 bg-cyan-500/20 hover:bg-cyan-500/30 px-3 py-2 text-xs font-orbitron font-bold tracking-widest text-cyan-200 transition box-glow active:scale-[0.98]"
            >
              <Radio size={14} className="animate-pulse" />
              EMIT ACTIVE PING
            </button>

            <button
              onClick={toggleTargetLock}
              className={`flex items-center justify-center gap-2 border px-3 py-2 text-xs font-orbitron font-bold tracking-widest transition active:scale-[0.98] ${
                targetLocked
                  ? "border-rose-500 bg-rose-950/80 text-rose-300 box-glow-red hover:bg-rose-900"
                  : "border-cyan-500/40 bg-cyan-950/50 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/20 box-glow"
              }`}
            >
              <Crosshair size={14} className={targetLocked ? "animate-spin" : ""} />
              {targetLocked ? "RELEASE TARGET LOCK" : "TOGGLE TARGET LOCK"}
            </button>
          </div>
        </div>
      </div>

      {/* AMBIENT HOLOGRAPHIC FLOOR REFLECTION & FOOTER */}
      <div className="relative z-10 px-4 py-2 border-t border-cyan-500/30 bg-[#020912]/95 flex flex-wrap items-center justify-between text-[9px] text-cyan-400/60 font-mono">
        <div className="flex items-center gap-3">
          <span>SYS_ID: HUD-9042-ALPHA</span>
          <span>•</span>
          <span className="text-emerald-400 font-bold">STATUS: ALL SUBSYSTEMS NOMINAL</span>
        </div>
        <div>INTERACTIVE CYBERNETIC DISPLAY © 2026 // HOUSE OF CODING</div>
      </div>
      <div className="h-4 w-full floor-reflection pointer-events-none opacity-40" />
    </div>
  )
}
