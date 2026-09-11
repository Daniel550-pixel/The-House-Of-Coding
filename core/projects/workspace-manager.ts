import fs from "node:fs/promises"
import path from "node:path"

import { FileReader } from "./file-reader"
import { FileWriter } from "./file-writer"

export type WorkspaceFile = {
    path: string
    size: number
    extension: string
}

export class WorkspaceManager {
    readonly reader = new FileReader()
    readonly writer = new FileWriter()

    constructor(
        readonly root: string
    ) {}

    resolveSafe(relativePath: string): string {
        const normalized = relativePath
            .replace(/\\/g, "/")
            .replace(/^\/+/, "")

        const target = path.resolve(
            this.root,
            normalized
        )

        const relative = path.relative(
            this.root,
            target
        )

        if (
            relative.startsWith("..") ||
            path.isAbsolute(relative)
        ) {
            throw new Error(
                `Path escapes workspace: ${relativePath}`
            )
        }

        return target
    }

    async listFiles(
        directory = "."
    ): Promise<WorkspaceFile[]> {
        const root = this.resolveSafe(directory)
        const result: WorkspaceFile[] = []

        const ignored = new Set([
            ".git",
            "node_modules",
            ".next",
            "dist",
            "build",
            "coverage"
        ])

        async function walk(
            current: string
        ): Promise<void> {
            const entries = await fs.readdir(
                current,
                { withFileTypes: true }
            )

            for (const entry of entries) {
                if (ignored.has(entry.name)) {
                    continue
                }

                const absolute = path.join(
                    current,
                    entry.name
                )

                if (entry.isDirectory()) {
                    await walk(absolute)
                    continue
                }

                const stat = await fs.stat(absolute)

                result.push({
                    path: path.relative(
                        root,
                        absolute
                    ).replace(/\\/g, "/"),
                    size: stat.size,
                    extension: path.extname(
                        entry.name
                    )
                })
            }
        }

        await walk(root)

        return result
    }

    async readFile(relativePath: string) {
        const file = this.resolveSafe(relativePath)
        return this.reader.read(file)
    }

    async writeFile(
        relativePath: string,
        content: string
    ) {
        const file = this.resolveSafe(relativePath)

        await this.writer.write(
            file,
            content
        )

        return {
            path: relativePath,
            bytes: Buffer.byteLength(
                content,
                "utf8"
            )
        }
    }

    async readProjectSnapshot(
        maxFiles = 80
    ) {
        const files = (
            await this.listFiles()
        ).slice(0, maxFiles)

        const snapshot = []

        for (const file of files) {
            try {
                const content =
                    await this.readFile(file.path)

                snapshot.push({
                    path: file.path,
                    content
                })
            } catch {
                snapshot.push({
                    path: file.path,
                    content: "[unreadable]"
                })
            }
        }

        return snapshot
    }
}
