import type { LLMProvider } from "../index"

export const DevelopmentLLMProvider: LLMProvider = {
    name: "development",

    async generate(request) {
        return {
            provider: "development",
            model: request.model ?? "house-development",
            content:
                `LLM development provider received the request.\n\n` +
                `Prompt:\n${request.prompt}`,
            raw: {
                status: "development",
                system: request.system ?? null
            }
        }
    }
}
