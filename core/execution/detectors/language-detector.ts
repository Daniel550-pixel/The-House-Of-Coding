import path from "node:path"
import { RuntimeRegistry } from "../runtimes/registry"

export function detectLanguage(
    filePath: string,
    registry: RuntimeRegistry
) {
    const extension = path.extname(filePath).toLowerCase()

    return registry
        .all()
        .find(runtime =>
            runtime.extensions.some(
                item => item.toLowerCase() === extension
            )
        )
        ?.language
}
