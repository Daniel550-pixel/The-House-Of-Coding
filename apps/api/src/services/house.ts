import "dotenv/config"
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
    ReviewerAgent,
    GeminiProvider,
    DevelopmentLLMProvider
} from "../../../../core"

const llm = new LLMRouter()

const preferredProvider = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase()

if (preferredProvider === "gemini" && process.env.GEMINI_API_KEY) {
    llm.register(GeminiProvider)
} else if (preferredProvider === "openai" && process.env.OPENAI_API_KEY) {
    llm.register(OpenAIProvider)
}

if (process.env.GEMINI_API_KEY && !llm.has("gemini")) {
    llm.register(GeminiProvider)
}

if (process.env.OPENAI_API_KEY && !llm.has("openai")) {
    llm.register(OpenAIProvider)
}

if (llm.providersList().length === 0) {
    llm.register(DevelopmentLLMProvider)
}

const projectRoot = process.cwd().replace(/[\\\/]apps[\\\/]api$/, "")
const projectService = new ProjectService(projectRoot)
const workspace = projectService.workspace

const runtimes = new RuntimeRegistry()

const runtimeDefinitions = [
    ["python", [".py"], "python"],
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
