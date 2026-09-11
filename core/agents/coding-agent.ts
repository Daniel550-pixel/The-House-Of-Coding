import { LLMRouter } from "../llm"
import { WorkspaceManager } from "../projects/workspace-manager"

export type CodeChange = {
    path: string
    content: string
}

export type CodingTask = {
    instruction: string
    language?: string
    apply?: boolean
}

function parseChanges(content: string): CodeChange[] {
    let value = content.trim()

    const fenced = value.match(
        /```json\s*([\s\S]*?)\s*```/i
    )

    if (fenced?.[1]) {
        value = fenced[1]
    }

    const parsed = JSON.parse(value)

    if (
        !parsed ||
        !Array.isArray(parsed.changes)
    ) {
        throw new Error(
            "LLM response did not contain a valid changes array"
        )
    }

    return parsed.changes
}

export class CodingAgent {
    constructor(
        private llm: LLMRouter,
        private workspace: WorkspaceManager
    ) {}

    async execute(task: CodingTask) {
        const snapshot =
            await this.workspace.readProjectSnapshot()

        const prompt = `
You are the Coding Agent inside The House Of Coding.

TASK:
${task.instruction}

LANGUAGE:
${task.language ?? "auto"}

PROJECT FILES:
${snapshot
    .map(file =>
        `--- ${file.path} ---\n${file.content}`
    )
    .join("\n\n")}

Return ONLY valid JSON:

{
  "summary": "what you changed",
  "changes": [
    {
      "path": "relative/path/to/file",
      "content": "complete file content"
    }
  ],
  "tests": [
    "commands or checks to perform"
  ],
  "risks": [
    "potential issues"
  ]
}
`

        const response =
            await this.llm.generate({
                prompt,
                system:
                    "You are a precise senior software engineer. Return valid JSON only.",
                temperature: 0.1
            })

        let changes: CodeChange[] = []

        try {
            changes = parseChanges(
                response.content
            )
        } catch {
            return {
                applied: false,
                parsed: false,
                response: response.content
            }
        }

        const applied: string[] = []

        if (task.apply !== false) {
            for (const change of changes) {
                await this.workspace.writeFile(
                    change.path,
                    change.content
                )

                applied.push(change.path)
            }
        }

        return {
            applied: task.apply !== false,
            files: applied,
            response: response.content
        }
    }
}
