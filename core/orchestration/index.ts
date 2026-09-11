import { CodingAgent } from "../agents/coding-agent"
import { LLMRouter } from "../llm"
import { ExecutionEngine } from "../execution"
import { WorkspaceManager } from "../projects/workspace-manager"

export class HouseOrchestrator {
    readonly codingAgent: CodingAgent

    constructor(
        readonly llm: LLMRouter,
        readonly execution: ExecutionEngine,
        readonly workspace: WorkspaceManager
    ) {
        this.codingAgent =
            new CodingAgent(
                llm,
                workspace
            )
    }

    async code(
        instruction: string,
        language?: string,
        apply = true
    ) {
        return this.codingAgent.execute({
            instruction,
            language,
            apply
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
