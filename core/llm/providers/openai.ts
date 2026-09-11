import type { LLMProvider } from "../index"

export const OpenAIProvider: LLMProvider = {
  name: "openai",

  async generate(request) {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured")
    }

    const model = request.model || process.env.OPENAI_MODEL || "gpt-5.5"

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey
      },
      body: JSON.stringify({
        model,
        instructions: request.system,
        input: request.prompt
      })
    })

    const data = await response.json() as {
      id?: string
      error?: { message?: string }
      output_text?: string
    }

    if (!response.ok) {
      throw new Error(
        (data.error && data.error.message) ||
        "OpenAI request failed with HTTP " + response.status
      )
    }

    return {
      provider: "openai",
      model,
      content: data.output_text || "",
      raw: { id: data.id }
    }
  }
}
