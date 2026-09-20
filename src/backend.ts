import type { SpindleAPI } from 'lumiverse-spindle-types'
import { b64Bytes, convert, convertText, dataUriImage, lorebaryCode, type Image } from './convert'

declare const spindle: SpindleAPI

// The API sends no CORS headers, so the browser can't call it: go through the host's CORS proxy.
// The URL is always built from a validated code, never taken from the user.
const API = 'https://lorebary.com/api/character/download/'

const COVER = 'https://lorebary.com/api/character/cover/'

// spindle.cors() is typed `unknown` in the SDK; shapes per the Spindle CORS-proxy docs.
type Proxied = { status: number; body: string; headers?: Record<string, string> }

/** The card JSON has no image; LoreBary serves the cover separately (JPEG, returned base64 by the proxy). */
async function downloadCover(code: string): Promise<Image> {
  const res = (await spindle.cors(COVER + code, { method: 'GET', responseType: 'arraybuffer', mediaType: 'image' })) as Proxied
  if (res.status !== 200) throw new Error(`cover: HTTP ${res.status}`)
  return { bytes: b64Bytes(res.body), mime: res.headers?.['content-type']?.split(';')[0] || 'image/jpeg' }
}

async function downloadCard(code: string): Promise<string> {
  const res = (await spindle.cors(API + code, { method: 'GET', headers: { Accept: 'application/json' } })) as Proxied
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
    const code = payload.type === 'import_url' ? lorebaryCode(String(payload.url ?? '')) : ''
    const { character, book, cover } =
      payload.type === 'import_url'
        ? convert(await downloadCard(code))
        : payload.filename
          ? convertText(String(payload.text ?? ''), payload.filename)
          : convert(String(payload.text ?? ''))
    let bookId: string | undefined
    let avatar = ''
    if (book) {
      const created = await spindle.world_books.create({ name: book.name, description: book.description }, userId)
      bookId = created.id
      for (const entry of book.entries) await spindle.world_books.entries.create(bookId, entry, userId)
    }
    if (character) {
      const created = await spindle.characters.create({ ...character, ...(bookId && { world_book_ids: [bookId] }) }, userId)
      // Avatar is best effort: the character is already imported if this fails.
      try {
        // PNG file itself > cover embedded in the JSON > LoreBary cover endpoint (links)
        const img: Image | undefined = payload.avatar
          ? { bytes: b64Bytes(String(payload.avatar.b64)), mime: String(payload.avatar.mime) }
          : (dataUriImage(cover) ?? (code ? await downloadCover(code) : undefined))
        if (img) {
          const ext = img.mime.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
          await spindle.characters.setAvatar(created.id, { data: img.bytes, filename: `avatar.${ext}`, mime_type: img.mime }, userId)
          avatar = ' + avatar'
        }
      } catch (e: any) {
        avatar = ` (avatar failed: ${e?.message ?? e})`
      }
    }
    const what = character ? character.name : book!.name
    reply({ type: 'result', ok: true, message: `${what}${book ? ` (${book.entries.length} lore entries)` : ''}${avatar}` })
  } catch (err: any) {
    reply({ type: 'result', ok: false, message: err?.message ?? String(err) })
  }
})

spindle.log.info('Lorebary Importer loaded')
