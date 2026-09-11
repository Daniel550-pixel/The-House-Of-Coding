import { spawn } from "node:child_process"
import { performance } from "node:perf_hooks"
import type {
    ExecutionRequest,
    ExecutionResult
} from "./results/types"
import { RuntimeRegistry } from "./runtimes/registry"

export class ExecutionEngine {
    constructor(private registry: RuntimeRegistry) {}

    async execute(request: ExecutionRequest): Promise<ExecutionResult> {
        const runtime = this.registry.get(request.language)

        if (!runtime) {
            throw new Error(
                `No runtime registered for language: ${request.language}`
            )
        }

        const args = [
            request.filePath,
            ...(request.args ?? [])
        ]

        const start = performance.now()

        return new Promise((resolve, reject) => {
            const child = spawn(runtime.command, args, {
                cwd: request.workingDirectory,
                shell: true,
                windowsHide: true
            })

            let stdout = ""
            let stderr = ""

            child.stdout.on("data", data => {
                stdout += data.toString()
            })

            child.stderr.on("data", data => {
                stderr += data.toString()
            })

            const timeout = setTimeout(() => {
                child.kill()
                reject(new Error("Execution timeout"))
            }, request.timeoutMs ?? 30000)

            child.on("error", error => {
                clearTimeout(timeout)
                reject(error)
            })

            child.on("close", code => {
                clearTimeout(timeout)

                const durationMs = Math.round(performance.now() - start)

                resolve({
                    language: request.language,
                    command: `${runtime.command} ${args.join(" ")}`,
                    stdout,
                    stderr,
                    exitCode: code ?? -1,
                    durationMs,
                    success: (code ?? -1) === 0
                })
            })
        })
    }
}
