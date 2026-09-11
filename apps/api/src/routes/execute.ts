import { Router } from "express"

const router = Router()

router.post("/", async (req, res) => {
    try {
        const {
            language,
            filePath,
            workingDirectory,
            args
        } = req.body

        if (!language || !filePath) {
            return res.status(400).json({
                error: "language and filePath are required"
            })
        }

        res.json({
            success: true,
            engine: "execution-engine",
            language,
            filePath,
            workingDirectory: workingDirectory ?? null,
            args: args ?? [],
            message: "Execution Engine endpoint ready"
        })
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error"
        })
    }
})

export default router
