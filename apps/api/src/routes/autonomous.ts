import { Router } from "express"
import { house } from "../services/house"

const router = Router()

router.post("/", async (req, res) => {
  try {
    const {
      instruction,
      language,
      filePath,
      maxIterations
    } = req.body ?? {}

    if (!instruction || !language || !filePath) {
      return res.status(400).json({
        success: false,
        error: "instruction, language and filePath are required"
      })
    }

    const result = await house.autonomousLoop.run({
      instruction,
      language,
      filePath,
      maxIterations
    })

    res.json({
      success: result.success,
      result
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Autonomous loop failed"
    })
  }
})

export default router
