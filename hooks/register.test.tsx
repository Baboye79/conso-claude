import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'conso-claude',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const NOW = Date.parse('2026-11-01T12:00:00Z')

const MEASURE = {
  context: { tokens: 80_000, window: 1_000_000, percent: 8 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 5, resetsAt: '2026-11-01T16:30:00Z' },
    { kind: 'seven_day', percentUsed: 92, resetsAt: '2026-11-01T11:00:00Z' },
  ],
  cost: { usd: 1.5 },
  changed: ['rateLimits'],
} as const

test('each main turn ends with a usage line in the transcript', async ($, on) => {
  const lines: string[] = []
  on('ui.log', (_, e) => {
    lines.push(e.text)

    return { value: undefined }
  })
  on('session.usage', () => ({ value: { startedAt: NOW, ...MEASURE } }))
  on('clock.now', () => ({ value: NOW }))
  on('turn.complete', () => ({ text: 'ok' }))

  await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 1 })
  expect(lines).toHaveLength(1)
  expect(lines[0]).toContain('5 h ░░░░░░░░ 5 % 4 h 30 min')
  expect(lines[0]).toContain('Contexte 8 %')
  expect(lines[0]).toContain('Coût estimé 1.50 $')

  await $.turn.complete({
    reason: 'answer',
    answer: 'ok',
    durationMs: 1,
    agentId: 'a1',
  })
  expect(lines).toHaveLength(1)
})

test('the band shows limits, context and cost, on every surface', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: { startedAt: NOW, context: { window: 1_000_000 }, rateLimits: [] },
  }))
  on('clock.now', () => ({ value: NOW }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /prochaine réponse/ })).toBeTruthy()
    await ui.unmount()
  }

  await $.session.measure(MEASURE)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /5 %/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /4 h 30 min/ })).toBeTruthy()
    // The weekly window's reset has passed: its 92 % no longer stands.
    expect(await ui.find({ type: 'Text', text: /réinitialisée/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /92 %/ })).toBeFalsy()
    expect(await ui.find({ type: 'Text', text: /8 %/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /1\.50 \$/ })).toBeTruthy()
    await ui.unmount()
  }
})

test('les limites sont copiées pour le widget macOS', async ($, on) => {
  const writes: { path: string; text: string }[] = []
  on('fs.write', (_, e) => {
    writes.push({ path: e.path, text: e.text })

    return { value: undefined }
  })
  on('env.get', () => ({ value: '/Users/test' }))
  on('clock.now', () => ({ value: NOW }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.measure({ ...MEASURE, rateLimits: [] })
  expect(writes).toHaveLength(0)

  await $.session.measure(MEASURE)
  expect(writes).toHaveLength(1)
  expect(writes[0].path).toBe(
    '/Users/test/Library/Application Support/ClaudeUsageWidget/limits.json',
  )
  const data = JSON.parse(writes[0].text)
  expect(data.windows[0]).toEqual({
    kind: 'five_hour',
    percentUsed: 5,
    resetsAt: '2026-11-01T16:30:00Z',
  })
  expect(data.readAt).toBe('2026-11-01T12:00:00.000Z')
})
