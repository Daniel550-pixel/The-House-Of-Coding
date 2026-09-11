import { spawn } from "node:child_process"
import { performance } from "node:perf_hooks"

import type {
    ExecutionRequest,
    ExecutionResult
} from "./results/types"

import { RuntimeRegistry } from "./runtimes/registry"

export class ExecutionEngine {
    constructor(private registry: RuntimeRegistry) {}

    async execute(
        request: ExecutionRequest
    ): Promise<ExecutionResult> {

        const runtime = this.registry.get(request.language)

        if (!runtime) {
            throw new Error(
                `No runtime registered for language: ${request.language}`
            )
        }

        const args = [request.filePath, ...(request.args ?? [])]
        const command = `${runtime.command} ${args.join(" ")}`

        const start = performance.now()

        return new Promise((resolve, reject) => {

            const child = spawn(
                runtime.command,
                args,
                {
                    cwd: request.workingDirectory || process.cwd(),
                    shell: true,
                    windowsHide: true
                }
            )

            let stdout = ""
            let stderr = ""

            const timeout = setTimeout(() => {
                child.kill()

                reject(
                    new Error(
                        `Execution timeout after ${
                            request.timeoutMs ?? 30000
                        }ms`
                    )
                )
            }, request.timeoutMs ?? 30000)

            child.stdout.on("data", chunk => {
                stdout += chunk.toString()
            })

            child.stderr.on("data", chunk => {
                stderr += chunk.toString()
            })

            child.on("error", error => {
                clearTimeout(timeout)
                reject(error)
            })

            child.on("close", code => {
                clearTimeout(timeout)

                const durationMs =
                    Math.round(performance.now() - start)

                const exitCode = code ?? -1

                resolve({
                    language: request.language,
                    command,
                    stdout,
                    stderr,
                    exitCode,
                    durationMs,
                    success: exitCode === 0
                })
            })
        })
    }
}
