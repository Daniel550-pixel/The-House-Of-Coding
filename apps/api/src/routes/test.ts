import { Router } from "express"
import {
    testerAgent,
    workspace
} from "../services/house"

const router = Router()

router.post("/analyze", async (req, res) => {
    try {
        const {
            path,
            language
        } = req.body ?? {}

        if (!path) {
            return res.status(400).json({
                success: false,
                error: "path is required"
            })
        }

        const code =
            await workspace.readFile(path)

        const result =
            await testerAgent.analyze({
                code,
                language
            })

        res.json({
            success: true,
            path,
            result
        })
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error
                ? error.message
                : "Test analysis failed"
        })
    }
})

export default router
