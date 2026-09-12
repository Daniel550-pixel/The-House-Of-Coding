import {
    LLMRouter,
    OpenAIProvider,
    DevelopmentLLMProvider,
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
if (process.env.OPENAI_API_KEY) {
    llm.register(OpenAIProvider)
}
llm.register(DevelopmentLLMProvider)

const projectRoot = process.cwd().replace(/[\\\/]apps[\\\/]web$/, "")
const projectService = new ProjectService(projectRoot)
const workspace = projectService.workspace

const runtimes = new RuntimeRegistry()

const runtimeDefinitions = [
    ["python", [".py"], "python3"],
    ["javascript", [".js", ".mjs", ".cjs"], "node"],
    ["typescript", [".ts", ".tsx"], "npx tsx"],
    ["php", [".php"], "php"],
    ["ruby", [".rb"], "ruby"],
    ["go", [".go"], "go run"],
    ["rust", [".rs"], "cargo run"],
    ["swift", [".swift"], "swift"],
    ["java", [".java"], "java"],
    ["c", [".c"], "gcc"],
    ["cpp", [".cpp", ".cc", ".cxx"], "g++"],
    ["csharp", [".cs"], "dotnet"],
    ["kotlin", [".kt", ".kts"], "kotlinc"]
] as const

for (const [language, extensions, command] of runtimeDefinitions) {
    runtimes.register({
        language,
        extensions: [...extensions],
        command
    })
}

const execution = new ExecutionEngine(runtimes)
const codingAgent = new CodingAgent(llm, workspace)
const debuggerAgent = new DebuggerAgent(llm)
const testerAgent = new TesterAgent(llm)
const reviewerAgent = new ReviewerAgent(llm)

const house = new HouseOrchestrator(
    llm,
    execution,
    workspace,
    debuggerAgent,
    testerAgent
)

export {
    llm,
    runtimes,
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
