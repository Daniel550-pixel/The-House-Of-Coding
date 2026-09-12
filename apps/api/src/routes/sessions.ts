import { Router } from "express"
import {
  createAgentSession,
  getAgentSession,
  serializeAgentSession,
  subscribeAgentSession
} from "../services/agent-sessions"

const router = Router()

router.post("/", (req, res) => {
  const { instruction, language, filePath, maxIterations } = req.body ?? {}

  if (!instruction || !language || !filePath) {
    return res.status(400).json({
      success: false,
      error: "instruction, language and filePath are required"
    })
  }

  const session = createAgentSession({
    instruction,
    language,
    filePath,
    maxIterations
  })

  res.status(202).json({
    success: true,
    session: serializeAgentSession(session)
  })
})

router.get("/:id", (req, res) => {
  const session = getAgentSession(req.params.id)

  if (!session) {
    return res.status(404).json({
      success: false,
      error: "Agent session not found"
    })
  }

  res.json({
    success: true,
    session: serializeAgentSession(session)
  })
})

router.get("/:id/events", (req, res) => {
  const session = getAgentSession(req.params.id)

  if (!session) {
    return res.status(404).json({
      success: false,
      error: "Agent session not found"
    })
  }

  res.status(200)
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache, no-transform")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders?.()

  const send = (event: unknown) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  send({ type: "session", session: serializeAgentSession(session) })
  const unsubscribe = subscribeAgentSession(session.id, send)

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n")
  }, 15000)

  req.on("close", () => {
    clearInterval(heartbeat)
    unsubscribe()
  })
})

export default router
