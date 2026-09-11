export interface LLMProviderConfig {
    apiKey?: string
    baseUrl?: string
    defaultModel?: string
}

export interface LLMProviderAdapter {
    name: string
    generate(
        prompt: string,
        options?: Record<string, unknown>
    ): Promise<unknown>
}
