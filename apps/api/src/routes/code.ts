import { Router } from "express"

const router = Router()

router.post("/", async (req, res) => {
    try {
        const {
            instruction,
            language,
            projectPath
        } = req.body

        if (!instruction) {
            return res.status(400).json({
                error: "instruction is required"
            })
        }

        res.json({
            success: true,
            agent: "coding-agent",
            instruction,
            language: language ?? "auto-detect",
            projectPath: projectPath ?? null,
            message: "Coding Agent endpoint ready"
        })
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error"
        })
    }
})

export default router
