import { Router } from "express"
import { reviewerAgent, workspace } from "../services/house"

const router = Router()

router.post("/", async (req, res) => {
    try {
        const { path, code, language } = req.body ?? {}

        if (typeof path !== "string" && typeof code !== "string") {
            return res.status(400).json({
                success: false,
                error: "path or code is required"
            })
        }

        const source = typeof code === "string"
            ? code
            : await workspace.readFile(path)

        const result = await reviewerAgent.review({
            code: source,
            language
        })

        res.json({
            success: true,
            path: path ?? null,
            result
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : "Review failed"
        })
    }
})

export default router
