import { CodingAgent } from "../agents/coding-agent"
import { DebuggerAgent } from "../agents/debugger"
import { TesterAgent } from "../agents/tester"
import { ExecutionEngine } from "../execution"
import { WorkspaceManager } from "../projects/workspace-manager"

export type AutonomousLoopRequest = {
  instruction: string
  language: string
  filePath: string
  maxIterations?: number
}

export type AutonomousAgent = "coding" | "runtime" | "debugger" | "tester" | "orchestrator"
export type AutonomousLoopStage = "code" | "execute" | "debug" | "test" | "complete" | "failed"

export type AutonomousLoopEvent = {
  iteration: number
  stage: AutonomousLoopStage
  agent: AutonomousAgent
  action: string
  message: string
  nextAgent?: AutonomousAgent
  durationMs?: number
}

export class AutonomousCodingLoop {
  constructor(
    private readonly coder: CodingAgent,
    private readonly debuggerAgent: DebuggerAgent,
    private readonly tester: TesterAgent,
    private readonly execution: ExecutionEngine,
    private readonly workspace: WorkspaceManager
  ) {}

  async run(initialRequest: AutonomousLoopRequest, onEvent?: (event: AutonomousLoopEvent) => void) {
    let request = { ...initialRequest }
    const maxIterations = Math.max(1, Math.min(request.maxIterations ?? 3, 5))
    const events: AutonomousLoopEvent[] = []
    const emit = (event: AutonomousLoopEvent) => {
      events.push(event)
      onEvent?.(event)
    }
    const timed = async <T>(event: Omit<AutonomousLoopEvent, "durationMs">, operation: () => Promise<T>) => {
      const started = Date.now()
      const result = await operation()
      const completed = { ...event, durationMs: Date.now() - started }
      emit(completed)
      return { result, durationMs: completed.durationMs }
    }

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      const coding = await timed({
        iteration,
        stage: "code",
        agent: "coding",
        action: "analyze-and-apply",
        nextAgent: "runtime",
        message: "Coding Agent analyzed the workspace and applied changes."
      }, () => this.coder.execute({ instruction: request.instruction, language: request.language, apply: true }))

      if (coding.result.parsed === false) {
        emit({ iteration, stage: "failed", agent: "orchestrator", action: "abort", message: "Coding Agent returned an unstructured response; no autonomous execution was attempted." })
        return { success: false, iteration, events, code: coding.result }
      }

      const execution = await timed({
        iteration,
        stage: "execute",
        agent: "runtime",
        action: "execute-target",
        nextAgent: "tester",
        message: `Runtime executed ${request.filePath}.`
      }, async () => {
        const absolute = this.workspace.resolveSafe(request.filePath)
        return this.execution.execute({ language: request.language, filePath: absolute, workingDirectory: this.workspace.root })
      })

      if (execution.result.success) {
        const testing = await timed({
          iteration,
          stage: "test",
          agent: "tester",
          action: "analyze-tests",
          nextAgent: "orchestrator",
          message: "Tester Agent analyzed the implementation after successful execution."
        }, async () => {
          const code = await this.workspace.readFile(request.filePath)
          return this.tester.analyze({ code, language: request.language })
        })

        emit({ iteration, stage: "complete", agent: "orchestrator", action: "complete-session", message: "Orchestrator completed the autonomous coding loop successfully." })

        return { success: true, iteration, events, code: coding.result, execution: execution.result, tests: testing.result }
      }

      const debugging = await timed({
        iteration,
        stage: "debug",
        agent: "debugger",
        action: "diagnose-failure",
        nextAgent: iteration === maxIterations ? "orchestrator" : "coding",
        message: "Debugger Agent diagnosed the execution failure."
      }, async () => {
        const code = await this.workspace.readFile(request.filePath).catch(() => undefined)
        return this.debuggerAgent.diagnose({ error: `${execution.result.stderr}\nExit code: ${execution.result.exitCode}`, code, language: request.language })
      })

      if (iteration === maxIterations) {
        emit({ iteration, stage: "failed", agent: "orchestrator", action: "max-iterations", message: "Orchestrator stopped after reaching the maximum autonomous iterations." })
        return { success: false, iteration, events, code: coding.result, execution: execution.result, debug: debugging.result }
      }

      request = {
        ...request,
        instruction: `${request.instruction}\n\nPrevious execution failed. Use this debugger diagnosis to correct the implementation:\n${debugging.result.content}`
      }
    }

    return { success: false, iteration: maxIterations, events }
  }
}
