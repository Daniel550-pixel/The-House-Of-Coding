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

const sessions = new Map<string, AgentSession>()

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
  void runAgentSession(session)
  return session
}

export function getAgentSession(id: string) {
  return sessions.get(id)
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

  try {
    session.result = await house.autonomousLoop.run(session.request, (event) => {
      session.events.push(event)
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
  }
}

export function serializeAgentSession(session: AgentSession) {
  const { subscribers: _subscribers, ...publicSession } = session
  return publicSession
}
