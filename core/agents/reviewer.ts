import { LLMRouter } from "../llm"

export class ReviewerAgent {
    constructor(
        private llm: LLMRouter
    ) {}

    async review(input: {
        code: string
        language?: string
    }) {
        return this.llm.generate({
            prompt: `
Review this code as a senior engineer.

LANGUAGE:
${input.language ?? "unknown"}

CODE:
${input.code}

Review:
- correctness
- security
- maintainability
- performance
- architecture
- bugs
- improvements
`,
            system:
                "You are a senior code reviewer.",
            temperature: 0.1
        })
    }
}
