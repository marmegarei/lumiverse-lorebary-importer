import type { SpindleFrontendContext } from 'lumiverse-spindle-types'
import { pngCardJson } from './png'

export function setup(ctx: SpindleFrontendContext) {
  const tab = ctx.ui.registerDrawerTab({
    id: 'import',
    title: 'Lorebary Importer',
    shortName: 'Lorebary',
    description: 'Import LoreBary characters by link or file',
    keywords: ['lorebary', 'import', 'janitor', 'character', 'lorebook'],
  })

  const links = document.createElement('textarea')
  links.placeholder = 'Paste LoreBary link(s), e.g. https://lorebary.com/character-marketplace?view=7DFB7D95 (one per line)'
  links.rows = 3
  links.style.cssText = 'width:100%;margin-bottom:6px;box-sizing:border-box'
  const go = document.createElement('button')
  go.textContent = 'Import from link(s)'
  go.style.marginBottom = '12px'
  const pick = document.createElement('button')
  pick.textContent = 'Choose Lorebary file(s) (.json, .png, .txt)…'
  const log = document.createElement('div')
  log.style.cssText = 'margin-top:8px;font-size:12px;white-space:pre-wrap;color:var(--lumiverse-text-muted)'
  tab.root.style.padding = '12px'
  tab.root.append(links, go, document.createElement('br'), pick, log)

  const names = new Map<string, string>()
  const line = (t: string) => log.append(t + '\n')

  go.onclick = () => {
    for (const link of links.value.split(/\s+/).filter(Boolean)) {
      const id = crypto.randomUUID()
      names.set(id, link.replace(/^https?:\/\/(www\.)?/, ''))
      ctx.sendToBackend({ type: 'import_url', id, url: link })
    }
    links.value = ''
  }

  pick.onclick = async () => {
    try {
      const files = await ctx.uploads.pickFile({ accept: ['.json', '.png', '.txt', 'application/json', 'image/png', 'text/plain'], multiple: true, maxSizeBytes: 20 * 1024 * 1024 })
      for (const f of files) {
        const id = crypto.randomUUID()
        names.set(id, f.name)
        try {
          const png = /\.png$/i.test(f.name)
          const text = png ? pngCardJson(f.bytes) : new TextDecoder().decode(f.bytes)
          ctx.sendToBackend({ type: 'import', id, text, filename: /\.txt$/i.test(f.name) ? f.name : undefined })
        } catch (e: any) {
          line(`✗ ${f.name}: ${e?.message ?? e}`)
        }
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
