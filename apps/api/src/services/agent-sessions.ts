import { mkdirSync, readFileSync, renameSync, existsSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import type { AutonomousLoopEvent, AutonomousLoopRequest } from "../../../../core/orchestration/autonomous-loop"
import { house } from "./house"

export type AgentSessionStatus = "queued" | "running" | "completed" | "failed"

export type AgentSession = {
  id: string
  request: AutonomousLoopRequest
  status: AgentSessionStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  events: AutonomousLoopEvent[]
  result?: unknown
  subscribers: Set<(event: AutonomousLoopEvent) => void>
}

type PersistedAgentSession = Omit<AgentSession, "subscribers">

const MAX_PERSISTED_SESSIONS = 100
const STORE_PATH = resolve(process.env.AGENT_SESSION_STORE ?? "data/agent-sessions.json")
const sessions = new Map<string, AgentSession>()

function loadSessions() {
  if (!existsSync(STORE_PATH)) return

  try {
    const persisted = JSON.parse(readFileSync(STORE_PATH, "utf8")) as PersistedAgentSession[]
    for (const session of persisted.slice(-MAX_PERSISTED_SESSIONS)) {
      sessions.set(session.id, { ...session, subscribers: new Set() })
    }
  } catch {
    // A corrupt history file must not prevent the API from starting.
  }
}

function persistSessions() {
  const directory = dirname(STORE_PATH)
  mkdirSync(directory, { recursive: true })

  const persisted = Array.from(sessions.values())
    .slice(-MAX_PERSISTED_SESSIONS)
    .map(({ subscribers: _subscribers, ...session }) => session)

  const temporaryPath = `${STORE_PATH}.tmp`
  writeFileSync(temporaryPath, JSON.stringify(persisted, null, 2), "utf8")
  renameSync(temporaryPath, STORE_PATH)
}

loadSessions()

const createId = () => `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export function createAgentSession(request: AutonomousLoopRequest) {
  const session: AgentSession = {
    id: createId(),
    request,
    status: "queued",
    createdAt: new Date().toISOString(),
    events: [],
    subscribers: new Set()
  }

  sessions.set(session.id, session)
  persistSessions()
  void runAgentSession(session)
  return session
}

export function getAgentSession(id: string) {
  return sessions.get(id)
}

export function listAgentSessions(limit = 25) {
  return Array.from(sessions.values())
    .slice(-Math.max(1, Math.min(limit, MAX_PERSISTED_SESSIONS)))
    .reverse()
    .map(serializeAgentSession)
}

export function subscribeAgentSession(id: string, subscriber: (event: AutonomousLoopEvent) => void) {
  const session = sessions.get(id)
  if (!session) return () => undefined

  session.subscribers.add(subscriber)
  for (const event of session.events) subscriber(event)

  return () => session.subscribers.delete(subscriber)
}

async function runAgentSession(session: AgentSession) {
  session.status = "running"
  session.startedAt = new Date().toISOString()
  persistSessions()

  try {
    session.result = await house.autonomousLoop.run(session.request, (event) => {
      session.events.push(event)
      persistSessions()
      for (const subscriber of session.subscribers) subscriber(event)
    })

    session.status = session.result && typeof session.result === "object" && "success" in session.result && session.result.success
      ? "completed"
      : "failed"
  } catch (error) {
    session.status = "failed"
    session.result = {
      success: false,
      error: error instanceof Error ? error.message : "Agent session failed"
    }
  } finally {
    session.completedAt = new Date().toISOString()
    persistSessions()
  }
}

export function serializeAgentSession(session: AgentSession): PersistedAgentSession {
  const { subscribers: _subscribers, ...publicSession } = session
  return publicSession
}
