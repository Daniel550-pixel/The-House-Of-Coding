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
app.use(express.json({ limit: "2mb" }))

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

app.listen(PORT, () => {
    console.log(`The House Of Coding API running on http://localhost:${PORT}`)
})
