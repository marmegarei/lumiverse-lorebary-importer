// Pure Lorebary -> Lumiverse conversion. No Spindle imports, so it is testable with plain `bun test`.
import type { CharacterCreateDTO, WorldBookEntryCreateDTO } from 'lumiverse-spindle-types'

export interface BookOut {
  name: string
  description: string
  entries: WorldBookEntryCreateDTO[]
}
export interface Converted {
  character?: CharacterCreateDTO
  book?: BookOut
}

type Obj = Record<string, any>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : [])

const label = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())

/** Readable text from Lorebary's nested objects. Drops empties/false/null; keeps `true` as the label only. */
function render(v: unknown, skip: string[] = [], depth = 0): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) {
    const items = v.map((x) => render(x, skip, depth + 1)).filter(Boolean)
    return items.every((s) => !s.includes('\n')) ? items.join(', ') : items.map((s) => `- ${s}`).join('\n')
  }
  if (!isObj(v)) return ''
  return Object.entries(v)
    .filter(([k]) => !skip.includes(k))
    .map(([k, x]) => {
      if (x === true) return `${label(k)}: yes`
      const t = render(x, skip, depth + 1)
      if (!t) return ''
      return t.includes('\n') || isObj(x) ? `${label(k)}:\n${t}` : `${label(k)}: ${t}`
    })
    .filter(Boolean)
    .join('\n')
}

// ponytail: `spectrums` (0-100 sliders) dropped, axis meaning isn't documented; `hasX: false` flags dropped as noise.
const SKIP = ['spectrums', 'hasTraumas', 'hasRecord']

const section = (title: string, body: string) => (body ? `\n\n[${title}]\n${body}` : '')

/** Personality is either prose, or a JSON object serialized inside a string (card-v2 structured export). */
function personalityText(p: unknown): string {
  if (typeof p === 'string' && p.trim().startsWith('{')) {
    try {
      p = JSON.parse(p)
    } catch {
      /* plain text that happens to start with "{" */
    }
  }
  return render(p, SKIP)
}

function relationshipsText(r: unknown): string {
  if (!Array.isArray(r)) return ''
  return r
    .filter(isObj)
    .map((x) => `- ${str(x.name)} (${[str(x.type), str(x.status)].filter(Boolean).join(', ')}): ${str(x.description)}`)
    .join('\n')
}

/** Data Lorebary keeps outside the standard card fields, folded into the description so nothing is lost. */
function extras(l: Obj): string {
  return (
    section('Appearance', str(l.appearance).trim()) +
    section('Background', render(l.background, SKIP)) +
    section('Relationships', relationshipsText(l.relationships)) +
    section('Gender', str(l.gender)) +
    section('Age', str(l.age))
  )
}

function fromCard(root: Obj): Converted {
  const d = isObj(root.data) ? root.data : {}
  const l = isObj(d.extensions?.lorebary) ? d.extensions.lorebary : {}
  const structured = typeof d.personality === 'string' && d.personality.trim().startsWith('{')
  const ext = { ...d.extensions }
  delete ext.lorebary
  const out: Converted = {
    character: {
      name: str(d.name) || 'Unnamed',
      // Freeform cards already hold everything in `description`; only structured cards need the extras.
      description: (str(d.description) + (l.isFreeForm ? '' : extras(l))).trimEnd(),
      personality: structured ? personalityText(d.personality) : str(d.personality) || personalityText(l.personality),
      scenario: str(d.scenario),
      first_mes: str(d.first_mes),
      mes_example: str(d.mes_example),
      creator: str(d.creator),
      creator_notes: str(d.creator_notes),
      system_prompt: str(d.system_prompt),
      post_history_instructions: str(d.post_history_instructions),
      tags: strs(d.tags),
      alternate_greetings: strs(d.alternate_greetings),
      extensions: ext,
    },
  }
  // Standard V2 embedded book (Lorebary's own downloads have null here).
  if (isObj(d.character_book) && Array.isArray(d.character_book.entries)) {
    out.book = {
      name: str(d.character_book.name) || `${out.character!.name} Lorebook`,
      description: str(d.character_book.description),
      entries: d.character_book.entries.filter(isObj).map((e: Obj) => ({
        key: strs(e.keys),
        keysecondary: strs(e.secondary_keys),
        content: str(e.content),
        comment: str(e.comment) || str(e.name),
        constant: !!e.constant,
        selective: !!e.selective,
        disabled: e.enabled === false,
        order_value: Number(e.insertion_order ?? e.priority ?? 100),
      })),
    }
  }
  return out
}

/** "detailed" export: flat root with personality/background/... as real objects. */
function fromDetailed(r: Obj): Converted {
  const msgs = (Array.isArray(r.initialMessages) ? r.initialMessages : [])
    .filter((m: Obj) => isObj(m) && m.isEnabled !== false && str(m.content))
    .map((m: Obj) => m.content as string)
  const dialogs = (Array.isArray(r.exampleDialogs) ? r.exampleDialogs : [])
    .filter((x: Obj) => isObj(x) && (str(x.userMessage) || str(x.characterResponse)))
    .map((x: Obj) => `<START>\n{{user}}: ${str(x.userMessage)}\n{{char}}: ${str(x.characterResponse)}`)
  const free = r.isFreeForm ? str(r.freeFormContent) : ''
  return {
    character: {
      name: str(r.name) || 'Unnamed',
      description: free || (str(r.description) + extras(r)).trimEnd(),
      personality: free ? '' : personalityText(r.personality),
      scenario: isObj(r.scenario) && r.scenario.enabled ? str(r.scenario.content) : '',
      first_mes: msgs[0] ?? '',
      alternate_greetings: msgs.slice(1),
      mes_example: dialogs.join('\n'),
      creator: str(r.author),
      tags: strs(r.tags),
    },
  }
}

/** Lorebary lorebook: `entries` is an object map keyed "1","2",... */
function fromLorebook(r: Obj): Converted {
  const entries = Object.values(r.entries as Obj)
    .filter(isObj)
    .map((e): WorldBookEntryCreateDTO => ({
      key: strs(e.key),
      keysecondary: strs(e.keysecondary),
      content: str(e.content),
      comment: str(e.comment) || strs(e.key)[0] || '',
      constant: !!e.constant,
      selective: !!e.selective && strs(e.keysecondary).length > 0,
      disabled: !!e.disable,
      order_value: Number(e.order ?? 100),
      position: Number(e.position ?? 0),
    }))
  return { book: { name: str(r.name) || 'Lorebary Lorebook', description: str(r.description), entries } }
}

/** Throws a user-readable Error when the input is not a recognizable Lorebary JSON export. */
export function convert(text: string): Converted {
  let r: unknown
  try {
    r = JSON.parse(text)
  } catch {
    throw new Error('Not valid JSON.')
  }
  if (!isObj(r)) throw new Error('Unexpected JSON: expected an object.')
  if (isObj(r.entries) && !('spec' in r)) return fromLorebook(r)
  if (isObj(r.data) && typeof r.spec === 'string') return fromCard(r)
  // Current LoreBary export (JSON and PNG): identity fields live under `meta`, the rest at the root.
  if (isObj(r.meta) && typeof r.meta.name === 'string' && (isObj(r.personality) || 'initialMessages' in r || 'freeFormContent' in r)) {
    return fromDetailed({ ...r.meta, ...r })
  }
  if (typeof r.name === 'string' && ('initialMessages' in r || isObj(r.personality) || 'freeFormContent' in r)) return fromDetailed(r)
  throw new Error('Unrecognized format: not a Lorebary character, card or lorebook JSON.')
}

/** `### Title\nbody` blocks of a markdown section. */
const subs = (md = ''): [string, string][] =>
  md
    .split(/^### /m)
    .slice(1)
    .map((b): [string, string] => {
      const nl = b.indexOf('\n')
      return nl < 0 ? [b.trim(), ''] : [b.slice(0, nl).trim(), b.slice(nl + 1).trim()]
    })

/** Lorebary "full text export" (markdown). Has no appearance/background/scenario, only the JSON/PNG do. */
function fromMarkdown(body: string, name: string): Converted {
  const parts = body.split(/^## /m)
  const sec: Record<string, string> = {}
  for (const p of parts.slice(1)) {
    const nl = p.indexOf('\n')
    sec[p.slice(0, nl < 0 ? undefined : nl).trim().toLowerCase()] = nl < 0 ? '' : p.slice(nl + 1).trim()
  }
  const tagLine = /^\*\*Tags:\*\*[ \t]*(.*)$/m
  const desc = sec['description'] ?? ''
  const msgs = subs(sec['first messages']).map((s) => s[1]).filter(Boolean)
  const dialogs = subs(sec['example dialogs']).flatMap(([, b]) => {
    const m = b.match(/^\*\*User:\*\*[ \t]*([\s\S]*?)\n\*\*(?!User:)[^*\n]+:\*\*[ \t]*([\s\S]*)$/)
    return m ? [`<START>\n{{user}}: ${m[1].trim()}\n{{char}}: ${m[2].trim()}`] : []
  })
  const links = subs(sec['connections']).map(([t, b]) => `- ${t}: ${b}`).join('\n')
  return {
    character: {
      name,
      description: (desc.replace(tagLine, '').trim() + section('Relationships', links)).trim(),
      personality: sec['personality'] ?? '',
      first_mes: msgs[0] ?? '',
      alternate_greetings: msgs.slice(1),
      mes_example: dialogs.join('\n'),
      creator: body.match(/^\*\*Author:\*\*[ \t]*(.+)$/m)?.[1].trim() ?? '',
      tags: (desc.match(tagLine)?.[1] ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    },
  }
}

/** Lorebary .txt export: markdown full export when it has `## ` sections, otherwise plain text kept whole as the description. */
export function convertText(text: string, filename = ''): Converted {
  const body = text.replace(/^﻿/, '').trim()
  if (body.startsWith('{')) return convert(body) // a .json saved as .txt
  if (!body) throw new Error('Empty file.')
  const name =
    body.match(/^#\s+(.+)$/m)?.[1].trim() ??
    body.match(/^(?:name|nome)\s*:\s*(.+)$/im)?.[1].trim() ??
    (filename.replace(/\.[^.]+$/, '') || 'Unnamed')
  if (/^## (description|personality)/im.test(body)) return fromMarkdown(body, name)
  return { character: { name, description: body } }
}
