import { expect, test } from 'bun:test'
import { convert } from '../src/convert'

const personality = JSON.stringify({ summary: 'Sly fox', traits: ['clever', 'vain'], quirks: '', spectrums: { social: 70 }, sexuality: { notes: '' } })

test('structured card-v2: personality string unpacked, lorebary extras folded into description', () => {
  const { character, book } = convert(
    JSON.stringify({
      spec: 'chara_card_v2',
      data: {
        name: 'Fox', description: 'A fox.', personality, first_mes: 'Hi', tags: ['a'], character_book: null,
        extensions: { lorebary: { appearance: '【Hair】\nRed', gender: 'female', relationships: [{ name: 'Bob', type: 'friend', status: 'close', description: 'Old pal' }], background: { backstory: 'Born in a den', traumas: { hasTraumas: false } } } },
      },
    }),
  )
  expect(book).toBeUndefined()
  expect(character!.personality).toBe('Summary: Sly fox\nTraits: clever, vain')
  expect(character!.description).toContain('[Appearance]\n【Hair】\nRed')
  expect(character!.description).toContain('Backstory: Born in a den')
  expect(character!.description).toContain('- Bob (friend, close): Old pal')
  expect(character!.description).not.toContain('Traumas')
  expect(character!.extensions).toEqual({})
})

test('detailed export: greetings, dialogs, scenario', () => {
  const { character } = convert(
    JSON.stringify({
      name: 'Fox', author: 'me', description: 'A fox.', personality: JSON.parse(personality), scenario: { enabled: false, content: 'x' },
      initialMessages: [{ content: 'One', isEnabled: true }, { content: 'Off', isEnabled: false }, { content: 'Two', isEnabled: true }],
      exampleDialogs: [{ userMessage: 'yo', characterResponse: 'hey' }],
    }),
  )
  expect(character).toMatchObject({ first_mes: 'One', alternate_greetings: ['Two'], scenario: '', creator: 'me' })
  expect(character!.mes_example).toBe('<START>\n{{user}}: yo\n{{char}}: hey')
})

test('lorebook map -> world book entries', () => {
  const { book, character } = convert(
    JSON.stringify({ name: 'Lore', description: 'd', entries: { '1': { uid: 1, key: ['dragon'], keysecondary: [], content: 'Big', selective: true, disable: false, order: 95, position: 0 } }, meta: {} }),
  )
  expect(character).toBeUndefined()
  expect(book!.entries[0]).toMatchObject({ key: ['dragon'], content: 'Big', selective: false, order_value: 95, comment: 'dragon' })
})

test('bad input gives readable errors', () => {
  expect(() => convert('hello')).toThrow('Not valid JSON')
  expect(() => convert('{"a":1}')).toThrow('Unrecognized')
})

// --- PNG / TXT ---
import { pngCardJson } from '../src/png'
import { convertText } from '../src/convert'

const chunk = (type: string, data: number[]) => {
  const out = new Uint8Array(12 + data.length)
  const v = new DataView(out.buffer)
  v.setUint32(0, data.length)
  out.set([...type].map((c) => c.charCodeAt(0)), 4)
  out.set(data, 8) // CRC left as zeros: the reader doesn't check it
  return out
}
const png = (...chunks: Uint8Array[]) => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunks.flatMap((c) => [...c]), ...chunk('IEND', [])])
const text = (key: string, value: string) => chunk('tEXt', [...key].map((c) => c.charCodeAt(0)).concat(0, [...value].map((c) => c.charCodeAt(0))))

test('png: chara chunk (utf-8 base64) -> card -> character', () => {
  const card = JSON.stringify({ spec: 'chara_card_v2', data: { name: 'Zoë', description: 'ñ 【Hair】', personality: 'Sly', extensions: { lorebary: { appearance: 'Red' } } } })
  const b64 = Buffer.from(card, 'utf-8').toString('base64')
  const json = pngCardJson(png(chunk('IHDR', new Array(13).fill(0)), text('chara', b64)))
  expect(json).toBe(card)
  const { character } = convert(json)
  expect(character).toMatchObject({ name: 'Zoë', personality: 'Sly' })
  expect(character!.description).toContain('[Appearance]\nRed')
})

test('png: ccv3 preferred, missing chunk and non-png give errors', () => {
  const v2 = Buffer.from('{"v":2}').toString('base64')
  const v3 = Buffer.from('{"v":3}').toString('base64')
  expect(pngCardJson(png(text('chara', v2), text('ccv3', v3)))).toBe('{"v":3}')
  expect(() => pngCardJson(png())).toThrow('no character data')
  expect(() => pngCardJson(new Uint8Array([1, 2, 3]))).toThrow('Not a PNG')
})

test('txt: title / Name: / filename fallback; whole text kept as description', () => {
  expect(convertText('# Fox\n\nIdentity: sly').character).toMatchObject({ name: 'Fox', description: '# Fox\n\nIdentity: sly' })
  expect(convertText('Name: Wolf\nManner: cold').character!.name).toBe('Wolf')
  expect(convertText('just prose', 'Bear.txt').character!.name).toBe('Bear')
  expect(convertText(JSON.stringify({ name: 'X', initialMessages: [] })).character!.name).toBe('X')
  expect(() => convertText('  ')).toThrow('Empty')
})
