import {
    LLMRouter,
    DevelopmentLLMProvider,
    RuntimeRegistry,
    ExecutionEngine,
    HouseOrchestrator
} from "../../../../core"

const llm = new LLMRouter()

llm.register(DevelopmentLLMProvider)

const runtimes = new RuntimeRegistry()

runtimes.register({
    language: "python",
    extensions: [".py"],
    command: "python"
})

runtimes.register({
    language: "javascript",
    extensions: [".js", ".mjs", ".cjs"],
    command: "node"
})

runtimes.register({
    language: "typescript",
    extensions: [".ts", ".tsx"],
    command: "npx tsx"
})

runtimes.register({
    language: "php",
    extensions: [".php"],
    command: "php"
})

runtimes.register({
    language: "ruby",
    extensions: [".rb"],
    command: "ruby"
})

runtimes.register({
    language: "go",
    extensions: [".go"],
    command: "go run"
})

runtimes.register({
    language: "rust",
    extensions: [".rs"],
    command: "cargo run"
})

runtimes.register({
    language: "swift",
    extensions: [".swift"],
    command: "swift"
})

export const execution = new ExecutionEngine(runtimes)

export const house = new HouseOrchestrator(
    llm,
    execution
)

export const runtimeRegistry = runtimes



