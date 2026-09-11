import express from "express"
import cors from "cors"
import dotenv from "dotenv"

import llmRouter from "./routes/llm"
import codeRouter from "./routes/code"
import executeRouter from "./routes/execute"
import languagesRouter from "./routes/languages"
import projectsRouter from "./routes/projects"
import testRouter from "./routes/test"
import debugRouter from "./routes/debug"
import autonomousRouter from "./routes/autonomous"

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT ?? 4000)

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]
}))

app.use(express.json({ limit: "10mb" }))

app.get("/", (_req, res) => {
  res.json({
    name: "The House Of Coding",
    service: "api",
    status: "online"
  })
})

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "the-house-of-coding-api",
    timestamp: new Date().toISOString()
  })
})

app.use("/llm", llmRouter)
app.use("/code", codeRouter)
app.use("/execute", executeRouter)
app.use("/languages", languagesRouter)
app.use("/projects", projectsRouter)
app.use("/test", testRouter)
app.use("/debug", debugRouter)
app.use("/autonomous", autonomousRouter)

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error)
  res.status(500).json({
    success: false,
    error: error instanceof Error ? error.message : "Internal server error"
  })
})

app.listen(PORT, "0.0.0.0", () => {
  console.log("")
  console.log("==============================================")
  console.log("       THE HOUSE OF CODING API")
  console.log("==============================================")
  console.log(`API:     http://localhost:${PORT}`)
  console.log(`Health:  http://localhost:${PORT}/health`)
  console.log(`Projects:http://localhost:${PORT}/projects`)
  console.log(`Code:    http://localhost:${PORT}/code`)
  console.log(`Execute: http://localhost:${PORT}/execute`)
  console.log(`Test:    http://localhost:${PORT}/test`)
  console.log(`Debug:   http://localhost:${PORT}/debug`)
  console.log(`Autonomous: http://localhost:${PORT}/autonomous`)
  console.log("==============================================")
  console.log("")
})
