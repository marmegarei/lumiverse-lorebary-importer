import type { SpindleAPI } from 'lumiverse-spindle-types'
import { convert, convertText, lorebaryCode } from './convert'

declare const spindle: SpindleAPI

// The API sends no CORS headers, so the browser can't call it: go through the host's CORS proxy.
// The URL is always built from a validated code, never taken from the user.
const API = 'https://lorebary.com/api/character/download/'

async function downloadCard(link: string): Promise<string> {
  // typed `unknown` in the SDK; shape per the Spindle CORS-proxy docs
  const res = (await spindle.cors(API + lorebaryCode(link), { method: 'GET', headers: { Accept: 'application/json' } })) as { status: number; body: string }
  if (res.status !== 200) {
    let msg = ''
    try {
      msg = JSON.parse(res.body).message
    } catch {
      /* not JSON */
    }
    throw new Error(msg || `LoreBary returned HTTP ${res.status}`)
  }
  return res.body
}

spindle.onFrontendMessage(async (payload: any, userId) => {
  if (payload?.type !== 'import' && payload?.type !== 'import_url') return
  const reply = (msg: object) => spindle.sendToFrontend({ ...msg, id: payload.id }, userId)
  try {
    const { character, book } =
      payload.type === 'import_url'
        ? convert(await downloadCard(String(payload.url ?? '')))
        : payload.filename
          ? convertText(String(payload.text ?? ''), payload.filename)
          : convert(String(payload.text ?? ''))
    let bookId: string | undefined
    if (book) {
      const created = await spindle.world_books.create({ name: book.name, description: book.description }, userId)
      bookId = created.id
      for (const entry of book.entries) await spindle.world_books.entries.create(bookId, entry, userId)
    }
    if (character) {
      await spindle.characters.create({ ...character, ...(bookId && { world_book_ids: [bookId] }) }, userId)
    }
    const what = character ? character.name : book!.name
    reply({ type: 'result', ok: true, message: `${what}${book ? ` (${book.entries.length} lore entries)` : ''}` })
  } catch (err: any) {
    reply({ type: 'result', ok: false, message: err?.message ?? String(err) })
  }
})

spindle.log.info('Lorebary Importer loaded')
