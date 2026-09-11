import type { LLMProviderAdapter, LLMProviderConfig } from "../types/provider"

export class HTTPProvider implements LLMProviderAdapter {
    name: string
    private config: LLMProviderConfig

    constructor(name: string, config: LLMProviderConfig) {
        this.name = name
        this.config = config
    }

    async generate(
        prompt: string,
        options: Record<string, unknown> = {}
    ): Promise<unknown> {
        if (!this.config.baseUrl) {
            throw new Error(`No baseUrl configured for provider: ${this.name}`)
        }

        const response = await fetch(this.config.baseUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(this.config.apiKey
                    ? { Authorization: `Bearer ${this.config.apiKey}` }
                    : {})
            },
            body: JSON.stringify({
                prompt,
                model: options.model ?? this.config.defaultModel,
                temperature: options.temperature ?? 0.2,
                system: options.system
            })
        })

        if (!response.ok) {
            const body = await response.text()
            throw new Error(
                `LLM request failed (${response.status}): ${body}`
            )
        }

        return response.json()
    }
}
