export type LanguageRuntime = {
    language: string
    extensions: string[]
    command: string
    buildCommand?: string
    testCommand?: string
}

export class RuntimeRegistry {
    private runtimes = new Map<string, LanguageRuntime>()

    register(runtime: LanguageRuntime) {
        this.runtimes.set(runtime.language.toLowerCase(), runtime)
    }

    get(language: string) {
        return this.runtimes.get(language.toLowerCase())
    }

    all() {
        return [...this.runtimes.values()]
    }
}
