import { LLMRouter } from "../llm"

export class TesterAgent {
    constructor(
        private llm: LLMRouter
    ) {}

    async analyze(input: {
        code: string
        language?: string
    }) {
        return this.llm.generate({
            prompt: `
Create a test strategy for this code.

LANGUAGE:
${input.language ?? "unknown"}

CODE:
${input.code}

Return:
- test cases
- edge cases
- expected results
- recommended test command
`,
            system:
                "You are a software testing specialist.",
            temperature: 0.1
        })
    }
}
