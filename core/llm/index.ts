import type { LLMRequest, LLMResponse } from "./types"

export type LLMProvider = {
    name: string
    generate: (request: LLMRequest) => Promise<LLMResponse>
}

export class LLMRouter {
    private providers = new Map<string, LLMProvider>()

    register(provider: LLMProvider) {
        this.providers.set(provider.name, provider)
    }

    has(provider: string) {
        return this.providers.has(provider)
    }

    providersList() {
        return [...this.providers.keys()]
    }

    async generate(request: LLMRequest): Promise<LLMResponse> {
        if (request.provider) {
            const selected = this.providers.get(request.provider)

            if (!selected) {
                throw new Error(
                    `LLM provider not registered: ${request.provider}`
                )
            }

            return selected.generate(request)
        }

        const first = this.providers.values().next().value as
            | LLMProvider
            | undefined

        if (!first) {
            throw new Error("No LLM providers are registered")
        }

        return first.generate(request)
    }
}
