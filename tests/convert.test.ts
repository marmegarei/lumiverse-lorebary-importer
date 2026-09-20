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
