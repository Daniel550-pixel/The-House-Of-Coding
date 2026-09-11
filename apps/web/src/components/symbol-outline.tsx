"use client"

import { useEffect, useMemo, useState } from "react"
import { Braces, ChevronDown, ChevronRight, Code2, FunctionSquare, Hash, Type, Variable } from "lucide-react"
import { getWorkspaceSymbols, type WorkspaceSymbol } from "../lib/api"

function iconFor(kind: WorkspaceSymbol["kind"]) {
  if (kind === "function") return FunctionSquare
  if (kind === "class") return Code2
  if (kind === "interface" || kind === "type") return Type
  if (kind === "variable") return Variable
  return Braces
}

export function SymbolOutline({
  filePath,
  onJump
}: {
  filePath: string
  onJump: (line: number) => void
}) {
  const [symbols, setSymbols] = useState<WorkspaceSymbol[]>([])
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!filePath) {
      setSymbols([])
      return
    }

    let cancelled = false
    setLoading(true)

    getWorkspaceSymbols({
      projectId: "house",
      filePath
    })
      .then(result => {
        if (!cancelled) setSymbols(result.symbols)
      })
      .catch(() => {
        if (!cancelled) setSymbols([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filePath])

  const grouped = useMemo(() => {
    const result = new Map<string, WorkspaceSymbol[]>()

    for (const symbol of symbols) {
      const existing = result.get(symbol.kind) ?? []
      existing.push(symbol)
      result.set(symbol.kind, existing)
    }

    return Array.from(result.entries())
  }, [symbols])

  return (
    <div className="border-t border-neutral-800">
      <button
        onClick={() => setCollapsed(value => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-neutral-500 hover:text-neutral-200"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <Hash size={12} />
        Outline
        <span className="ml-auto text-[10px] text-neutral-700">{loading ? "..." : symbols.length}</span>
      </button>

      {!collapsed && (
        <div className="max-h-52 overflow-auto pb-2">
          {!filePath ? (
            <div className="px-4 py-2 text-[11px] text-neutral-700">Open a file to inspect symbols.</div>
          ) : loading ? (
            <div className="px-4 py-2 text-[11px] text-neutral-700">Indexing symbols...</div>
          ) : symbols.length === 0 ? (
            <div className="px-4 py-2 text-[11px] text-neutral-700">No symbols detected.</div>
          ) : (
            grouped.map(([kind, items]) => {
              const Icon = iconFor(kind as WorkspaceSymbol["kind"])
              return (
                <div key={kind}>
                  <div className="px-4 py-1 text-[9px] uppercase tracking-widest text-neutral-700">{kind}</div>
                  {items.map(symbol => (
                    <button
                      key={`${symbol.kind}:${symbol.name}:${symbol.line}:${symbol.column}`}
                      onClick={() => onJump(symbol.line)}
                      className="flex w-full items-center gap-2 px-4 py-1 text-left text-[11px] text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
                      title={symbol.signature}
                    >
                      <Icon size={12} />
                      <span className="truncate">{symbol.name}</span>
                      <span className="ml-auto text-[9px] text-neutral-700">{symbol.line}</span>
                    </button>
                  ))}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
