import { atom, read, update } from 'claude-code'
import type { Register, SessionMeasureInput } from 'claude-code'

import type { Usage, Window } from '../types'

const REFRESH_MS = 60_000
const BAR_WIDTH = 8

const usage = atom({ plugin: 'conso-claude', key: 'usage' } as const, null, {
  shape: 'usage-1',
})

const LABELS: Record<string, string> = {
  five_hour: '5 h',
  seven_day: 'Hebdo',
  spend_limit: 'Dépense',
}

function toUsage(
  m: Pick<SessionMeasureInput, 'context' | 'rateLimits' | 'cost'>,
  readAt: number,
): Usage {
  return {
    windows: m.rateLimits.map(({ kind, percentUsed, resetsAt }) => ({
      kind,
      percentUsed,
      resetsAt,
    })),
    contextTokens: m.context.tokens,
    contextSize: m.context.window,
    contextPercent: m.context.percent,
    usd: m.cost?.usd,
    readAt,
  }
}

function bar(percent: number): string {
  const filled = Math.round((Math.min(percent, 100) / 100) * BAR_WIDTH)

  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

function barColor(percent: number): string | undefined {
  if (percent >= 90) return 'error'
  if (percent >= 70) return 'warning'

  return undefined
}

function timeLeft(ms: number): string {
  const minutes = Math.ceil(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ${minutes % 60} min`

  return `${Math.floor(hours / 24)} j ${hours % 24} h`
}

function isReset(window: Window, now: number): boolean {
  return window.resetsAt !== undefined && Date.parse(window.resetsAt) <= now
}

function summary(current: Usage): string {
  const parts = current.windows.map(window => {
    const label = LABELS[window.kind] ?? window.kind
    if (isReset(window, current.readAt)) {
      return `${label} ${bar(0)} 0 % réinitialisée`
    }
    const left = window.resetsAt
      ? ` ${timeLeft(Date.parse(window.resetsAt) - current.readAt)}`
      : ''

    return `${label} ${bar(window.percentUsed)} ${window.percentUsed} %${left}`
  })
  if (current.contextPercent !== undefined) {
    parts.push(`Contexte ${current.contextPercent} %`)
  }
  if (current.usd !== undefined) {
    parts.push(`Coût estimé ${current.usd.toFixed(2)} $`)
  }

  return parts.join('   ')
}

// Copie des limites pour le widget macOS « Consommation Claude »
const WIDGET_FILE = 'Library/Application Support/ClaudeUsageWidget/limits.json'

async function exportForWidget(
  $: { env: { get: (n: 'HOME') => Promise<string | undefined> }; fs: { write: (p: string, t: string) => Promise<void> } },
  current: Usage,
): Promise<void> {
  // Une session sans abonnement n'a pas de lecture : on garde la dernière bonne.
  if (current.windows.length === 0) return
  const home = await $.env.get('HOME')
  if (!home) return
  const text = JSON.stringify({
    windows: current.windows,
    readAt: new Date(current.readAt).toISOString(),
  })
  await $.fs.write(`${home}/${WIDGET_FILE}`, text).catch(() => undefined)
}

export const register: Register = on => {
  on('turn.complete', async ($, e, next) => {
    const ended = await next(e)
    if (e.agentId) return ended

    const [measure, now] = await Promise.all([
      $.session.usage(),
      $.clock.now(),
    ])
    $.ui.log(summary(toUsage(measure, now)))

    return ended
  })

  on('session.start', async ($, e, next) => {
    const started = await next(e)

    const refresh = async () => {
      const [measure, now] = await Promise.all([
        $.session.usage(),
        $.clock.now(),
      ])
      const current = toUsage(measure, now)
      await update($, usage, () => current)
      await exportForWidget($, current)
    }
    await refresh()
    // The windows only move on a response; this keeps the countdowns honest.
    $.clock.every(REFRESH_MS, () => void refresh())

    return started
  })

  on('session.measure', async ($, e, next) => {
    const now = await $.clock.now()
    const current = toUsage(e, now)
    await update($, usage, () => current)
    await exportForWidget($, current)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, usage)
    if (e.props.hasSurvey || !current) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const percent = current.contextPercent

    return (
      <Box flexWrap="wrap" columnGap={3}>
        {current.windows.length === 0 && (
          <Text dimColor>Limites : après la prochaine réponse</Text>
        )}
        {current.windows.map(window => {
          const hasReset = isReset(window, current.readAt)
          const used = hasReset ? 0 : window.percentUsed

          return (
            <Box columnGap={1}>
              <Text bold>{LABELS[window.kind] ?? window.kind}</Text>
              <Text color={barColor(used)}>
                {bar(used)} {used} %
              </Text>
              {hasReset ? (
                <Text dimColor>réinitialisée</Text>
              ) : (
                window.resetsAt && (
                  <Text dimColor>
                    {timeLeft(Date.parse(window.resetsAt) - current.readAt)}
                  </Text>
                )
              )}
            </Box>
          )
        })}
        {percent !== undefined && (
          <Box columnGap={1}>
            <Text bold>Contexte</Text>
            <Text color={barColor(percent)}>{percent} %</Text>
          </Box>
        )}
        {current.usd !== undefined && (
          <Box columnGap={1}>
            <Text bold>Coût estimé</Text>
            <Text>{current.usd.toFixed(2)} $</Text>
          </Box>
        )}
      </Box>
    )
  })
}
