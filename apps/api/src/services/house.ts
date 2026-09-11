import {
    LLMRouter,
    OpenAIProvider,
    RuntimeRegistry,
    ExecutionEngine,
    HouseOrchestrator,
    ProjectService,
    CodingAgent,
    DebuggerAgent,
    TesterAgent,
    ReviewerAgent
} from "../../../../core"

const llm = new LLMRouter()

llm.register(OpenAIProvider)

const projectRoot =
    process.cwd().replace(
        /[\\\/]apps[\\\/]api$/,
        ""
    )

const projectService =
    new ProjectService(projectRoot)

const workspace =
    projectService.workspace

const runtimes =
    new RuntimeRegistry()

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

runtimes.register({
    language: "java",
    extensions: [".java"],
    command: "java"
})

runtimes.register({
    language: "c",
    extensions: [".c"],
    command: "gcc"
})

runtimes.register({
    language: "cpp",
    extensions: [".cpp", ".cc", ".cxx"],
    command: "g++"
})

runtimes.register({
    language: "csharp",
    extensions: [".cs"],
    command: "dotnet"
})

runtimes.register({
    language: "kotlin",
    extensions: [".kt", ".kts"],
    command: "kotlinc"
})

const execution =
    new ExecutionEngine(runtimes)

const house =
    new HouseOrchestrator(
        llm,
        execution,
        workspace
    )

const codingAgent =
    new CodingAgent(
        llm,
        workspace
    )

const debuggerAgent =
    new DebuggerAgent(llm)

const testerAgent =
    new TesterAgent(llm)

const reviewerAgent =
    new ReviewerAgent(llm)

export {
    llm,
    runtimes,

    // Compatibility alias for existing routes
    runtimes as runtimeRegistry,

    execution,
    house,
    projectService,
    workspace,
    codingAgent,
    debuggerAgent,
    testerAgent,
    reviewerAgent
}
