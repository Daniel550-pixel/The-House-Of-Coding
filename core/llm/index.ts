export type LLMProvider = {
    name: string
    generate: (prompt: string, options?: Record<string, unknown>) => Promise<unknown>
}

export type LLMRequest = {
    prompt: string
    model?: string
    provider?: string
    temperature?: number
    system?: string
}

export type LLMResponse = {
    provider: string
    model: string
    content: string
    raw?: unknown
}

export class LLMRouter {
    private providers = new Map<string, LLMProvider>()

    register(provider: LLMProvider) {
        this.providers.set(provider.name, provider)
    }

    async generate(request: LLMRequest): Promise<LLMResponse> {
        const providerName = request.provider ?? "default"
        const provider = this.providers.get(providerName)

        if (!provider) {
            throw new Error(`LLM provider not registered: ${providerName}`)
        }

        const result = await provider.generate(request.prompt, {
            model: request.model,
            temperature: request.temperature,
            system: request.system
        })

        return {
            provider: provider.name,
            model: request.model ?? "default",
            content: typeof result === "string"
                ? result
                : JSON.stringify(result),
            raw: result
        }
    }
}
