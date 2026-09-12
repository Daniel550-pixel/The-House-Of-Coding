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

  async run(
    initialRequest: AutonomousLoopRequest,
    onEvent?: (event: AutonomousLoopEvent) => void
  ) {
    let request = { ...initialRequest }
    const maxIterations = Math.max(1, Math.min(request.maxIterations ?? 3, 5))
    const events: AutonomousLoopEvent[] = []
    const emit = (event: AutonomousLoopEvent) => {
      events.push(event)
      onEvent?.(event)
    }
    const timed = async <T>(event: Omit<AutonomousLoopEvent, "durationMs">, operation: () => Promise<T>) => {
      const started = Date.now()
      emit(event)
      const result = await operation()
      return { result, durationMs: Date.now() - started }
    }

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      const coding = await timed({
        iteration,
        stage: "code",
        agent: "coding",
        action: "analyze-and-apply",
        nextAgent: "runtime",
        message: "Coding Agent analyzing workspace and applying changes."
      }, () => this.coder.execute({
        instruction: request.instruction,
        language: request.language,
        apply: true
      }))
      events[events.length - 1].durationMs = coding.durationMs

      if (coding.result.parsed === false) {
        emit({
          iteration,
          stage: "failed",
          agent: "orchestrator",
          action: "abort",
          message: "Coding Agent returned an unstructured response; no autonomous execution was attempted."
        })
        return { success: false, iteration, events, code: coding.result }
      }

      const execution = await timed({
        iteration,
        stage: "execute",
        agent: "runtime",
        action: "execute-target",
        nextAgent: "tester",
        message: `Executing ${request.filePath}.`
      }, async () => {
        const absolute = this.workspace.resolveSafe(request.filePath)
        return this.execution.execute({
          language: request.language,
          filePath: absolute,
          workingDirectory: this.workspace.root
        })
      })
      events[events.length - 1].durationMs = execution.durationMs

      if (execution.result.success) {
        const testing = await timed({
          iteration,
          stage: "test",
          agent: "tester",
          action: "analyze-tests",
          nextAgent: "orchestrator",
          message: "Execution succeeded; requesting test analysis."
        }, async () => {
          const code = await this.workspace.readFile(request.filePath)
          return this.tester.analyze({ code, language: request.language })
        })
        events[events.length - 1].durationMs = testing.durationMs

        emit({
          iteration,
          stage: "complete",
          agent: "orchestrator",
          action: "complete-session",
          message: "Autonomous coding loop completed successfully."
        })

        return {
          success: true,
          iteration,
          events,
          code: coding.result,
          execution: execution.result,
          tests: testing.result
        }
      }

      const debugging = await timed({
        iteration,
        stage: "debug",
        agent: "debugger",
        action: "diagnose-failure",
        nextAgent: iteration === maxIterations ? "orchestrator" : "coding",
        message: "Execution failed; Debugger Agent analyzing the failure."
      }, async () => {
        const code = await this.workspace.readFile(request.filePath).catch(() => undefined)
        return this.debuggerAgent.diagnose({
          error: `${execution.result.stderr}\nExit code: ${execution.result.exitCode}`,
          code,
          language: request.language
        })
      })
      events[events.length - 1].durationMs = debugging.durationMs

      if (iteration === maxIterations) {
        emit({
          iteration,
          stage: "failed",
          agent: "orchestrator",
          action: "max-iterations",
          message: "Maximum autonomous iterations reached."
        })

        return {
          success: false,
          iteration,
          events,
          code: coding.result,
          execution: execution.result,
          debug: debugging.result
        }
      }

      request = {
        ...request,
        instruction: `${request.instruction}\n\nPrevious execution failed. Use this debugger diagnosis to correct the implementation:\n${debugging.result.content}`
      }
    }

    return {
      success: false,
      iteration: maxIterations,
      events
    }
  }
}
