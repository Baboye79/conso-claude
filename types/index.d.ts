export type Window = { kind: string; percentUsed: number; resetsAt?: string }

export type Usage = {
  windows: Window[]
  contextTokens?: number
  contextSize: number
  contextPercent?: number
  usd?: number
  readAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'conso-claude': { usage: Shaped<Usage | null> }
  }
}
