# Lorebary Importer for Lumiverse

Spindle extension for [Lumiverse](https://github.com/prolix-oc/Lumiverse) that imports **LoreBary** exports (JSON) as native Lumiverse characters and world books. Free and MIT-licensed: use it, fork it, improve it.

Extensão Spindle para o Lumiverse que importa exports **JSON do LoreBary** como personagens e world books nativos. Grátis, licença MIT: usa, faz fork, melhora.

## What it converts / O que converte

| LoreBary export | Result in Lumiverse |
|---|---|
| Character card JSON (`chara_card_v2`, structured) | Character. `personality` (a JSON object inside a string) becomes readable text; appearance, background, relationships and gender are folded into the description instead of being lost |
| "Detailed" character JSON | Character with first message, extra greetings, example dialogs, scenario, tags |
| Freeform character | Character (freeform text kept as the description) |
| Lorebook JSON | World book with all entries (keys, secondary keys, constant, order, position) |
| Card with an embedded standard V2 `character_book` | Character + attached world book |

Not supported: TXT exports and PNG cards (Lumiverse already imports standard PNG cards natively), cover images, the `spectrums` sliders (axis meaning is undocumented).

## Install / Instalação

Lumiverse → Extensions panel → install from GitHub URL:

```
https://github.com/marmegarei/lumiverse-lorebary-importer
```

Grant the `characters` and `world_books` permissions. Then open **Lorebary** in the sidebar (or `Ctrl+K`), pick one or more `.json` files.

## Develop

```bash
bun install
bun test          # converter tests
bun run typecheck
bun run build     # writes dist/ (committed, so Lumiverse can install without building)
```

`src/convert.ts` is a pure function (`convert(text)`), easy to reuse or extend. Formats were derived from public LoreBary export samples; if an export fails, open an issue with a redacted sample.
