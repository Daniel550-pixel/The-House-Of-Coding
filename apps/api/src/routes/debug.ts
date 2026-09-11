import { Router } from "express"
import {
    debuggerAgent
} from "../services/house"

const router = Router()

router.post("/", async (req, res) => {
    try {
        const {
            error,
            code,
            language
        } = req.body ?? {}

        if (!error) {
            return res.status(400).json({
                success: false,
                error: "error is required"
            })
        }

        const result =
            await debuggerAgent.diagnose({
                error,
                code,
                language
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
                : "Debugger failed"
        })
    }
})

export default router
