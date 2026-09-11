import { LLMRouter } from "../llm"

export type CodingTask = {
    instruction: string
    language?: string
    projectPath?: string
    files?: string[]
}

export type CodingResult = {
    response: string
    language?: string
    projectPath?: string
}

export class CodingAgent {
    constructor(private llm: LLMRouter) {}

    async execute(task: CodingTask): Promise<CodingResult> {
        const system = `
You are the Coding Agent inside The House Of Coding.

Responsibilities:
- Understand the requested coding task.
- Respect the project's existing architecture.
- Produce production-quality code.
- Preserve existing functionality unless explicitly instructed otherwise.
- Identify files that need to be created or changed.
- Explain required commands and tests.
`

        const prompt = `
CODING TASK:
${task.instruction}

LANGUAGE:
${task.language ?? "auto-detect"}

PROJECT:
${task.projectPath ?? "current workspace"}

FILES:
${task.files?.join("\n") ?? "not provided"}

Return:
1. Analysis
2. Files to create/change
3. Code
4. Commands
5. Tests
6. Risks
`

        const result = await this.llm.generate({
            prompt,
            system,
            temperature: 0.2
        })

        return {
            response: result.content,
            language: task.language,
            projectPath: task.projectPath
        }
    }
}
