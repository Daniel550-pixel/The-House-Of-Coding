import { CodingAgent } from "../agents/coding-agent"
import { LLMRouter } from "../llm"
import { ExecutionEngine } from "../execution"
import { WorkspaceManager } from "../projects/workspace-manager"
import { AutonomousCodingLoop } from "./autonomous-loop"

export class HouseOrchestrator {
    readonly codingAgent: CodingAgent
    readonly autonomousLoop: AutonomousCodingLoop

    constructor(
        readonly llm: LLMRouter,
        readonly execution: ExecutionEngine,
        readonly workspace: WorkspaceManager,
        readonly debuggerAgent?: import("../agents/debugger").DebuggerAgent,
        readonly testerAgent?: import("../agents/tester").TesterAgent
    ) {
        this.codingAgent = new CodingAgent(llm, workspace)

        if (!debuggerAgent || !testerAgent) {
            throw new Error("DebuggerAgent and TesterAgent are required for autonomous execution")
        }

        this.autonomousLoop = new AutonomousCodingLoop(
            this.codingAgent,
            debuggerAgent,
            testerAgent,
            execution,
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

export { AutonomousCodingLoop } from "./autonomous-loop"
