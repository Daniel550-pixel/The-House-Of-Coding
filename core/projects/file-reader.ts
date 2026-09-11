import fs from "node:fs/promises"

export class FileReader {
    async read(filePath: string): Promise<string> {
        return fs.readFile(filePath, "utf8")
    }

    async exists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath)
            return true
        } catch {
            return false
        }
    }
}
