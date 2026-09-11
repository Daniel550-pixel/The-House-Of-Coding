import OpenAI from "openai"
import type { LLMProvider } from "../index"

export const OpenAIProvider: LLMProvider = {
    name: "openai",

    async generate(request) {
        const apiKey = process.env.OPENAI_API_KEY

        if (!apiKey) {
            throw new Error(
                "OPENAI_API_KEY is not configured"
            )
        }

        const client = new OpenAI({
            apiKey
        })

        const response = await client.responses.create({
            model:
                request.model ??
                process.env.OPENAI_MODEL ??
                "gpt-5.5",
            instructions: request.system,
            input: request.prompt
        })

        return {
            provider: "openai",
            model:
                request.model ??
                process.env.OPENAI_MODEL ??
                "gpt-5.5",
            content: response.output_text,
            raw: {
                id: response.id
            }
        }
    }
}
