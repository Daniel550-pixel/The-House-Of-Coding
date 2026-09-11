import { CodingAgent } from "../agents/coding-agent"
import { LLMRouter } from "../llm"
import { ExecutionEngine } from "../execution"

export class HouseOrchestrator {
    readonly codingAgent: CodingAgent

    constructor(
        readonly llm: LLMRouter,
        readonly execution: ExecutionEngine
    ) {
        this.codingAgent = new CodingAgent(llm)
    }

    async code(
        instruction: string,
        language?: string,
        projectPath?: string
    ) {
        return this.codingAgent.execute({
            instruction,
            language,
            projectPath
        })
    }

    async execute(
        language: string,
        filePath: string,
        workingDirectory?: string,
        args?: string[]
    ) {
        return this.execution.execute({
            language,
            filePath,
            workingDirectory,
            args
        })
    }
}
