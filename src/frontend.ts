import type { SpindleFrontendContext } from 'lumiverse-spindle-types'

export function setup(ctx: SpindleFrontendContext) {
  const tab = ctx.ui.registerDrawerTab({
    id: 'import',
    title: 'Lorebary Importer',
    shortName: 'Lorebary',
    description: 'Import LoreBary characters and lorebooks (JSON)',
    keywords: ['lorebary', 'import', 'janitor', 'character', 'lorebook'],
  })

  const pick = document.createElement('button')
  pick.textContent = 'Choose Lorebary JSON file(s)…'
  const log = document.createElement('div')
  log.style.cssText = 'margin-top:8px;font-size:12px;white-space:pre-wrap;color:var(--lumiverse-text-muted)'
  tab.root.style.padding = '12px'
  tab.root.append(pick, log)

  const names = new Map<string, string>()
  const line = (t: string) => log.append(t + '\n')

  pick.onclick = async () => {
    try {
      const files = await ctx.uploads.pickFile({ accept: ['.json', 'application/json'], multiple: true, maxSizeBytes: 20 * 1024 * 1024 })
      for (const f of files) {
        const id = crypto.randomUUID()
        names.set(id, f.name)
        ctx.sendToBackend({ type: 'import', id, text: new TextDecoder().decode(f.bytes) })
      }
    } catch (e: any) {
      line(`✗ ${e?.message ?? e}`)
    }
  }

  const unsub = ctx.onBackendMessage((p: any) => {
    if (p?.type !== 'result') return
    line(`${p.ok ? '✓' : '✗'} ${names.get(p.id) ?? ''}: ${p.message}`)
  })

  return () => {
    unsub()
    tab.destroy()
  }
}
