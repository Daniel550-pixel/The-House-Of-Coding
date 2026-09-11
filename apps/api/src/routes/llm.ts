import { Router } from "express"

const router = Router()

router.post("/", async (req, res) => {
    try {
        const {
            prompt,
            model,
            provider,
            temperature,
            system
        } = req.body

        if (!prompt) {
            return res.status(400).json({
                error: "prompt is required"
            })
        }

        res.json({
            success: true,
            provider: provider ?? "default",
            model: model ?? "default",
            temperature: temperature ?? 0.2,
            system: system ?? null,
            prompt,
            message: "LLM router endpoint ready"
        })
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error"
        })
    }
})

export default router
