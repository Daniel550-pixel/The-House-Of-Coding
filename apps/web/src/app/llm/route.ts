import { NextRequest, NextResponse } from "next/server"
import { house } from "../../services/house"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    if (!body?.prompt) {
      return NextResponse.json(
        { success: false, error: "prompt is required" },
        { status: 400 }
      )
    }

    const result = await house.llm.generate({
      prompt: body.prompt,
      model: body.model,
      provider: body.provider,
      temperature: body.temperature,
      system: body.system
    })

    return NextResponse.json({
      success: true,
      result
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
