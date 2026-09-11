import path from "node:path"
import { RuntimeRegistry } from "../runtimes/registry"

export function detectLanguage(
    filePath: string,
    registry: RuntimeRegistry
): string | undefined {
    const extension = path.extname(filePath).toLowerCase()

    return registry
        .all()
        .find(runtime =>
            runtime.extensions
                .map(ext => ext.toLowerCase())
                .includes(extension)
        )
        ?.language
}
