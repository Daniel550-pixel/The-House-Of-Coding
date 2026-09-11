import { Router } from "express"
import { runtimeRegistry } from "../services/house"

const router = Router()

router.get("/", (_req, res) => {
    res.json({
        success: true,
        count: runtimeRegistry.all().length,
        languages: runtimeRegistry.all()
    })
})

export default router
