import { Router } from "express"
import { house } from "../services/house"

const router = Router()

router.post("/", async (req, res) => {
    try {
        if (!req.body?.prompt) {
            return res.status(400).json({
                success: false,
                error: "prompt is required"
            })
        }

        const result = await house.llm.generate({
            prompt: req.body.prompt,
            model: req.body.model,
            provider: req.body.provider,
            temperature: req.body.temperature,
            system: req.body.system
        })

        res.json({
            success: true,
            result
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error
                ? error.message
                : "Unknown error"
        })
    }
})

export default router
