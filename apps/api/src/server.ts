import express from "express"
import cors from "cors"
import dotenv from "dotenv"

import llmRouter from "./routes/llm"
import codeRouter from "./routes/code"
import executeRouter from "./routes/execute"
import languagesRouter from "./routes/languages"
import projectsRouter from "./routes/projects"

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT ?? 4000)

app.use(cors())
app.use(express.json({ limit: "5mb" }))

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

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error)

    res.status(500).json({
        success: false,
        error: error instanceof Error
            ? error.message
            : "Internal server error"
    })
})

app.listen(PORT, "0.0.0.0", () => {
    console.log("")
    console.log("==============================================")
    console.log("       THE HOUSE OF CODING API")
    console.log("==============================================")
    console.log(`API:    http://localhost:${PORT}`)
    console.log(`Health: http://localhost:${PORT}/health`)
    console.log(`LLM:    http://localhost:${PORT}/llm`)
    console.log(`Code:   http://localhost:${PORT}/code`)
    console.log(`Exec:   http://localhost:${PORT}/execute`)
    console.log(`Lang:   http://localhost:${PORT}/languages`)
    console.log("==============================================")
    console.log("")
})
