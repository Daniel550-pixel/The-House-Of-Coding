import path from "node:path"

import { WorkspaceManager } from "./workspace-manager"

export type Project = {
    id: string
    name: string
    path: string
}

export class ProjectService {
    readonly workspace: WorkspaceManager

    constructor(
        readonly root: string
    ) {
        this.workspace =
            new WorkspaceManager(root)
    }

    listProjects(): Project[] {
        return [
            {
                id: "house",
                name: "The House Of Coding",
                path: this.root
            }
        ]
    }

    getProject(id: string): Project {
        const project =
            this.listProjects().find(
                item => item.id === id
            )

        if (!project) {
            throw new Error(
                `Project not found: ${id}`
            )
        }

        return project
    }

    getWorkspace(id: string) {
        this.getProject(id)

        return this.workspace
    }
}

export function createProjectService() {
    const root = path.resolve(
        process.cwd(),
        "../.."
    )

    return new ProjectService(root)
}
