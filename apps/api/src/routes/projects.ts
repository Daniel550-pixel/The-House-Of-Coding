import { Router } from "express"
import { projectService } from "../services/house"

const router = Router()

router.get("/", (_req, res) => {
    res.json({
        success: true,
        projects: projectService.listProjects()
    })
})

router.get("/:id/files", async (req, res) => {
    try {
        const workspace =
            projectService.getWorkspace(
                req.params.id
            )

        const files =
            await workspace.listFiles()

        res.json({
            success: true,
            project: req.params.id,
            count: files.length,
            files
        })
    } catch (error) {
        res.status(404).json({
            success: false,
            error: error instanceof Error
                ? error.message
                : "Project not found"
        })
    }
})

router.get("/:id/file", async (req, res) => {
    try {
        const workspace =
            projectService.getWorkspace(
                req.params.id
            )

        const filePath =
            String(req.query.path ?? "")

        if (!filePath) {
            return res.status(400).json({
                success: false,
                error: "path query parameter is required"
            })
        }

        const content =
            await workspace.readFile(filePath)

        res.json({
            success: true,
            path: filePath,
            content
        })
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error
                ? error.message
                : "Unable to read file"
        })
    }
})

router.post("/:id/file", async (req, res) => {
    try {
        const workspace =
            projectService.getWorkspace(
                req.params.id
            )

        const {
            path,
            content
        } = req.body ?? {}

        if (
            typeof path !== "string" ||
            typeof content !== "string"
        ) {
            return res.status(400).json({
                success: false,
                error: "path and content are required"
            })
        }

        const result =
            await workspace.writeFile(
                path,
                content
            )

        res.status(201).json({
            success: true,
            ...result
        })
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error
                ? error.message
                : "Unable to write file"
        })
    }
})

export default router
