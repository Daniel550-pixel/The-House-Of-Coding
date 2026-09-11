import { Router } from "express"
import fs from "node:fs"
import path from "node:path"

const router = Router()

router.get("/", (_req, res) => {
    try {
        const file = path.resolve(
            process.cwd(),
            "..",
            "..",
            "config",
            "languages.json"
        )

        if (!fs.existsSync(file)) {
            return res.status(404).json({
                error: "language registry not found"
            })
        }

        const registry = JSON.parse(
            fs.readFileSync(file, "utf8")
        )

        res.json({
            success: true,
            ...registry
        })
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error"
        })
    }
})

export default router
