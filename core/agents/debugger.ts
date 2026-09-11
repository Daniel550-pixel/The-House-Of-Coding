import { LLMRouter } from "../llm"

export class DebuggerAgent {
    constructor(
        private llm: LLMRouter
    ) {}

    async diagnose(input: {
        error: string
        code?: string
        language?: string
    }) {
        const response =
            await this.llm.generate({
                prompt: `
Diagnose this coding error.

LANGUAGE:
${input.language ?? "unknown"}

ERROR:
${input.error}

CODE:
${input.code ?? "[not provided]"}

Return:
1. root cause
2. exact fix
3. corrected code if needed
4. verification steps
`,
                system:
                    "You are an expert debugging agent.",
                temperature: 0.1
            })

        return response
    }
}
