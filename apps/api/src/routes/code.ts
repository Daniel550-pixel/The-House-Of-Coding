import { Router } from "express"
import { house } from "../services/house"

const router = Router()

router.post("/", async (req, res) => {
    try {
        if (!req.body?.instruction) {
            return res.status(400).json({
                success: false,
                error: "instruction is required"
            })
        }

        const result = await house.code(
            req.body.instruction,
            req.body.language,
            req.body.projectPath
        )

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
