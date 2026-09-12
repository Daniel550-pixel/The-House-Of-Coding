import type { LLMProvider } from "../index"

type GeminiInteractionResponse = {
  id?: string
  model?: string
  status?: string
  error?: { message?: string }
  steps?: Array<{
    type?: string
    content?: Array<{ type?: string; text?: string }>
  }>
}

export const GeminiProvider: LLMProvider = {
  name: "gemini",

  async generate(request) {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured")
    }

    const model = request.model || process.env.GEMINI_MODEL || "gemini-3.8-flash"

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        model,
        input: request.prompt,
        ...(request.system ? { system_instruction: request.system } : {}),
        ...(typeof request.temperature === "number"
          ? { generation_config: { temperature: request.temperature } }
          : {}),
        store: false
      })
    })

    const data = await response.json() as GeminiInteractionResponse

    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        "Gemini request failed with HTTP " + response.status
      )
    }

    const content = (data.steps ?? [])
      .filter(step => step.type === "model_output" || !step.type)
      .flatMap(step => step.content ?? [])
      .filter(part => part.type === "text" && part.text)
      .map(part => part.text)
      .join("")

    return {
      provider: "gemini",
      model: data.model || model,
      content,
      raw: { id: data.id, status: data.status }
    }
  }
}
