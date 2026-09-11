import { LLMRouter } from "../llm"
import { CodingAgent } from "../agents/coding-agent"
import { ExecutionEngine } from "../execution"
import { RuntimeRegistry } from "../execution/runtimes/registry"

export class HouseOrchestrator {
    readonly codingAgent: CodingAgent

    constructor(
        private llm: LLMRouter,
        private execution: ExecutionEngine
    ) {
        this.codingAgent = new CodingAgent(llm)
    }

    async code(instruction: string, language?: string) {
        return this.codingAgent.execute({
            instruction,
            language
        })
    }

    async execute(
        language: string,
        filePath: string,
        workingDirectory?: string
    ) {
        return this.execution.execute({
            language,
            filePath,
            workingDirectory
        })
    }
}
