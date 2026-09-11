export type ExecutionRequest = {
    language: string
    filePath: string
    workingDirectory?: string
    args?: string[]
    timeoutMs?: number
}

export type ExecutionResult = {
    language: string
    command: string
    stdout: string
    stderr: string
    exitCode: number
    durationMs: number
    success: boolean
}
