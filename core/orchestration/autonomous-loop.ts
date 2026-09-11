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

export type AutonomousLoopEvent = {
  iteration: number
  stage: "code" | "execute" | "debug" | "test" | "complete" | "failed"
  message: string
}

export class AutonomousCodingLoop {
  constructor(
    private readonly coder: CodingAgent,
    private readonly debugger: DebuggerAgent,
    private readonly tester: TesterAgent,
    private readonly execution: ExecutionEngine,
    private readonly workspace: WorkspaceManager
  ) {}

  async run(
    request: AutonomousLoopRequest,
    onEvent?: (event: AutonomousLoopEvent) => void
  ) {
    const maxIterations = Math.max(1, Math.min(request.maxIterations ?? 3, 5))
    const events: AutonomousLoopEvent[] = []

    const emit = (event: AutonomousLoopEvent) => {
      events.push(event)
      onEvent?.(event)
    }

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      emit({ iteration, stage: "code", message: "Coding Agent analyzing workspace and applying changes." })

      const codeResult = await this.coder.execute({
        instruction: request.instruction,
        language: request.language,
        apply: true
      })

      if (codeResult.parsed === false) {
        emit({ iteration, stage: "failed", message: "Coding Agent returned an unstructured response; no autonomous execution was attempted." })
        return { success: false, iteration, events, code: codeResult }
      }

      emit({ iteration, stage: "execute", message: `Executing ${request.filePath}.` })

      const absolute = this.workspace.resolveSafe(request.filePath)
      const executionResult = await this.execution.execute({
        language: request.language,
        filePath: absolute,
        workingDirectory: this.workspace.root
      })

      if (executionResult.success) {
        emit({ iteration, stage: "test", message: "Execution succeeded; requesting test analysis." })

        const code = await this.workspace.readFile(request.filePath)
        const testResult = await this.tester.analyze({
          code,
          language: request.language
        })

        emit({ iteration, stage: "complete", message: "Autonomous coding loop completed successfully." })

        return {
          success: true,
          iteration,
          events,
          code: codeResult,
          execution: executionResult,
          tests: testResult
        }
      }

      emit({ iteration, stage: "debug", message: "Execution failed; Debugger Agent analyzing the failure." })

      const code = await this.workspace.readFile(request.filePath).catch(() => undefined)
      const debugResult = await this.debugger.diagnose({
        error: `${executionResult.stderr}\nExit code: ${executionResult.exitCode}`,
        code,
        language: request.language
      })

      if (iteration === maxIterations) {
        emit({ iteration, stage: "failed", message: "Maximum autonomous iterations reached." })
        return {
          success: false,
          iteration,
          events,
          code: codeResult,
          execution: executionResult,
          debug: debugResult
        }
      }

      request = {
        ...request,
        instruction: `${request.instruction}\n\nPrevious execution failed. Use this debugger diagnosis to correct the implementation:\n${debugResult.content}`
      }
    }

    return { success: false, iteration: maxIterations, events }
  }
}
