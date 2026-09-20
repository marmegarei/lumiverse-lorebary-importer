import type { SpindleAPI } from 'lumiverse-spindle-types'
import { convert, convertText } from './convert'

declare const spindle: SpindleAPI

spindle.onFrontendMessage(async (payload: any, userId) => {
  if (payload?.type !== 'import') return
  const reply = (msg: object) => spindle.sendToFrontend({ ...msg, id: payload.id }, userId)
  try {
    const { character, book } = (payload.filename ? convertText(String(payload.text ?? ''), payload.filename) : convert(String(payload.text ?? '')))
    let bookId: string | undefined
    if (book) {
      const created = await spindle.world_books.create({ name: book.name, description: book.description })
      bookId = created.id
      for (const entry of book.entries) await spindle.world_books.entries.create(bookId, entry)
    }
    if (character) {
      await spindle.characters.create({ ...character, ...(bookId && { world_book_ids: [bookId] }) })
    }
    const what = character ? character.name : book!.name
    reply({ type: 'result', ok: true, message: `${what}${book ? ` (${book.entries.length} lore entries)` : ''}` })
  } catch (err: any) {
    reply({ type: 'result', ok: false, message: err?.message ?? String(err) })
  }
})

spindle.log.info('Lorebary Importer loaded')
