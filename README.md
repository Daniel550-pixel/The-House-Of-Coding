# The House Of Coding

The House Of Coding is an AI-native coding environment combining project workspaces, LLM coding agents, multi-language execution, testing, debugging, and review in one system.

## Architecture

```text
Web UI
  │
  ├── Project Explorer
  ├── Code Editor
  ├── AI Coder
  ├── Run / Save
  └── Autonomous Loop
          │
          ▼
       API Layer
          │
   ┌──────┼───────────────┐
   │      │               │
Projects Agents       Execution
   │      │               │
Workspace Coder        Runtime Registry
Reader    Debugger     Execution Engine
Writer    Tester
          Reviewer
             │
             ▼
          LLM Router
             │
        Provider Layer
```

## Current capabilities

- Workspace-safe project and file access
- LLM provider abstraction
- OpenAI provider integration
- Coding, debugging, testing, and review agents
- Multi-language runtime registry
- Local execution with stdout, stderr, exit code, and duration capture
- Bounded autonomous code → execute → debug → retry → test loop
- Next.js web workspace
- Express/TypeScript API

## Supported runtimes

Python, JavaScript, TypeScript, PHP, Ruby, Go, Rust, Swift, Java, C, C++, C#, and Kotlin are registered by the runtime layer when their local toolchains are available.

Language support is registry-driven and can be extended without changing the core UI.

## Repository structure

```text
apps/
  api/                  Express API
  web/                  Next.js application
core/
  agents/               Coding, debugger, tester, reviewer
  execution/            Runtime registry and execution engine
  llm/                  LLM router and providers
  orchestration/        House orchestration and autonomous loop
  projects/             Workspace and file management
config/                 Language and runtime configuration
integrations/           Git, GitHub, VS Code, terminal integration points
languages/              Language-specific integration directories
scripts/                Development and maintenance scripts
tests/                  Runtime and integration tests
```

## Local development

Prerequisites:

- Node.js
- npm
- Git
- Language runtimes for languages you want to execute
- OpenAI API key for real LLM operation

Install dependencies:

```powershell
npm install
npm --prefix apps/api install
npm --prefix apps/web install
```

Configure the API key only in the local environment. Never commit secrets.

Start the development environment:

```powershell
npm run dev
```

Default local services:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

## API surface

```text
GET  /health
GET  /projects
GET  /projects/:id/files
GET  /projects/:id/file?path=...
POST /projects/:id/file
GET  /languages
POST /llm
POST /code
POST /execute
POST /test/analyze
POST /debug
POST /autonomous
```

## Autonomous coding loop

The autonomous endpoint accepts an instruction, language, and target file and runs a bounded workflow:

```text
Code
 ↓
Execute
 ↓
Success ───────────────► Test analysis ─► Complete
 ↓
Failure
 ↓
Debugger
 ↓
Code correction
 ↓
Execute again
```

The loop is capped at a small number of iterations and returns stage events, execution data, and agent results.

## Security

Workspace paths are resolved and checked so requests cannot traverse outside the configured project root. Local code execution is still privileged host execution. Before any production deployment that accepts untrusted code, add sandboxing or containers, resource limits, process isolation, filesystem restrictions, and language/runtime allowlists.

## Git workflow

Keep dependencies, build artifacts, local environment files, and secrets out of Git. Keep `main` buildable and use feature branches for larger changes.

## Roadmap

1. Full live editor/file tree integration
2. Autonomous loop controls and streamed agent events
3. Structured test execution and diagnostics
4. Provider routing and local-model adapters
5. Sandboxed execution
6. Git/GitHub-aware agent operations
7. Rich code intelligence, diagnostics, and review surfaces
