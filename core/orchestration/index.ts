import { CodingAgent } from "../agents/coding-agent"
import { DebuggerAgent } from "../agents/debugger"
import { TesterAgent } from "../agents/tester"
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
    readonly debuggerAgent: DebuggerAgent,
    readonly testerAgent: TesterAgent
  ) {
    this.codingAgent = new CodingAgent(llm, workspace)
    this.autonomousLoop = new AutonomousCodingLoop(
      this.codingAgent,
      debuggerAgent,
      testerAgent,
      execution,
      workspace
    )
  }

  async code(instruction: string, language?: string, apply = true) {
    return this.codingAgent.execute({ instruction, language, apply })
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
