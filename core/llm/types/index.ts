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
