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

// --- current LoreBary export: identity under `meta`, rest at root (same JSON in .json and inside .png) ---
const metaRooted = {
  meta: { name: 'Fox', author: 'me', description: 'A <i>fox</i>.', tags: ['a', 'b'], gender: 'male', age: '19', coverImage: 'data:image/webp;base64,AAAA' },
  appearance: '【Hair】\nRed',
  personality: JSON.parse(personality),
  background: { backstory: 'Born in a den', traumas: { hasTraumas: false } },
  scenario: { enabled: true, content: 'A rainy alley' },
  initialMessages: [{ id: '1', content: 'One' }, { id: '2', content: 'Two' }],
  exampleDialogs: [{ id: '1', userMessage: 'yo', characterResponse: 'hey' }],
  relationships: [{ name: 'Bob', type: 'rival', status: 'unknown', description: 'Old foe' }],
  isFreeForm: false,
  freeFormContent: '',
}

test('meta-rooted export: fields read from meta, extras folded into description', () => {
  const { character } = convert(JSON.stringify(metaRooted))
  expect(character).toMatchObject({ name: 'Fox', creator: 'me', tags: ['a', 'b'], first_mes: 'One', alternate_greetings: ['Two'], scenario: 'A rainy alley', personality: 'Summary: Sly fox\nTraits: clever, vain' })
  expect(character!.description).toStartWith('A <i>fox</i>.')
  for (const s of ['[Appearance]', '[Background]', '[Relationships]', '[Gender]\nmale', '[Age]\n19']) expect(character!.description).toContain(s)
  expect(character!.mes_example).toBe('<START>\n{{user}}: yo\n{{char}}: hey')
})

test('png: ~200 KB chunk (real cards embed the cover image) no longer overflows the stack', () => {
  const big = JSON.stringify({ ...metaRooted, meta: { ...metaRooted.meta, coverImage: 'x'.repeat(200_000) } })
  const json = pngCardJson(png(text('chara', Buffer.from(big).toString('base64'))))
  expect(json.length).toBe(big.length)
  expect(convert(json).character!.name).toBe('Fox')
})

test('txt full export (markdown): sections parsed, [object Object] ignored', () => {
  const { character } = convertText(
    [
      '# Fox', '', '**Chat Name:** F', '**Nicknames:** [object Object]', '**Author:** me', '',
      '## Description', 'A fox.', '', '**Tags:** a, b', '',
      '## Personality', '**Traits:** clever, vain', '', '**Quirks:**', 'Sly.', '',
      '## First Messages', '### Message 1', 'One', '', '### Message 2', 'Two', '',
      '## Example Dialogs', '### Dialog 1', '**User:** *waves* "yo"', '**Fox:** *nods* "hey"', '',
      '## Connections', '', '### Bob (Rival)', 'Old foe.',
    ].join('\n'),
  )
  expect(character).toMatchObject({ name: 'Fox', creator: 'me', tags: ['a', 'b'], first_mes: 'One', alternate_greetings: ['Two'] })
  expect(character!.personality).toBe('**Traits:** clever, vain\n\n**Quirks:**\nSly.')
  expect(character!.description).toBe('A fox.\n\n[Relationships]\n- Bob (Rival): Old foe.')
  expect(character!.mes_example).toBe('<START>\n{{user}}: *waves* "yo"\n{{char}}: *nods* "hey"')
})

import { lorebaryCode } from '../src/convert'

test('lorebaryCode: link or bare code, lorebary.com only', () => {
  expect(lorebaryCode('https://lorebary.com/character-marketplace?view=7DFB7D95')).toBe('7DFB7D95')
  expect(lorebaryCode(' https://www.lorebary.com/character-marketplace?x=1&view=7DFB7D95&y=2 ')).toBe('7DFB7D95')
  expect(lorebaryCode('7DFB7D95')).toBe('7DFB7D95')
  expect(() => lorebaryCode('https://evil.com/character-marketplace?view=7DFB7D95')).toThrow('lorebary.com')
  expect(() => lorebaryCode('https://lorebary.com.evil.com/?view=7DFB7D95')).toThrow('lorebary.com')
  expect(() => lorebaryCode('https://lorebary.com/character-marketplace')).toThrow('Not a LoreBary')
  expect(() => lorebaryCode('https://lorebary.com/?view=../../x')).toThrow('Not a LoreBary')
  expect(() => lorebaryCode('hello world')).toThrow('Not a LoreBary')
})
