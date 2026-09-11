import { Router } from "express"

const router = Router()

router.get("/", (_req, res) => {
    res.json({
        success: true,
        projects: []
    })
})

router.post("/", (req, res) => {
    const {
        name,
        path
    } = req.body

    if (!name) {
        return res.status(400).json({
            error: "project name is required"
        })
    }

    res.status(201).json({
        success: true,
        project: {
            name,
            path: path ?? null
        }
    })
})

export default router
