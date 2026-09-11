import { LLMRouter } from "../llm"

export type CodingTask = {
    instruction: string
    language?: string
    projectPath?: string
}

export class CodingAgent {
    constructor(private llm: LLMRouter) {}

    async execute(task: CodingTask) {
        const system = `
You are the Coding Agent inside The House Of Coding.

You analyze coding requests, determine implementation steps,
produce code, identify affected files, and provide verification steps.
Preserve existing project functionality unless explicitly instructed otherwise.
`

        const prompt = `
TASK:
${task.instruction}

LANGUAGE:
${task.language ?? "auto-detect"}

PROJECT:
${task.projectPath ?? "current workspace"}

Return:
- analysis
- files to create/change
- implementation
- commands
- tests
- risks
`

        return this.llm.generate({
            prompt,
            system,
            temperature: 0.2
        })
    }
}
