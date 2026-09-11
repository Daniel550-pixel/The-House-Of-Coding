import { Router } from "express"
import { house } from "../services/house"

const router = Router()

router.post("/", async (req, res) => {
    try {
        const {
            language,
            filePath,
            workingDirectory,
            args
        } = req.body ?? {}

        if (!language || !filePath) {
            return res.status(400).json({
                success: false,
                error: "language and filePath are required"
            })
        }

        const result = await house.execute(
            language,
            filePath,
            workingDirectory,
            args
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
