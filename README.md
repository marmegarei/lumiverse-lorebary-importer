# Lorebary Importer for Lumiverse

Spindle extension for [Lumiverse](https://github.com/prolix-oc/Lumiverse) that imports **LoreBary** exports (JSON) as native Lumiverse characters and world books. Free and MIT-licensed: use it, fork it, improve it.

Extensão Spindle para o Lumiverse que importa exports **JSON do LoreBary** como personagens e world books nativos. Grátis, licença MIT: usa, faz fork, melhora.

## Import by link / Importar por link

Paste a LoreBary character link (e.g. `https://lorebary.com/character-marketplace?view=7DFB7D95`) or just its code in the **Lorebary** tab and press *Import from link(s)*; one per line for several. The server downloads the character's public card from LoreBary and imports it. Needs the `cors_proxy` permission (LoreBary's API has no CORS headers, so the request goes through the Lumiverse server). Only characters, and only if the creator allows downloads; otherwise you get LoreBary's error message.

Cola o link de um personagem do LoreBary (ou só o código) no separador **Lorebary** e carrega em *Import from link(s)*. Só personagens, e só se o criador permitir downloads.

## What it converts / O que converte

| LoreBary export | Result in Lumiverse |
|---|---|
| **Current LoreBary JSON export** (identity under `meta`; same JSON is inside its `.png`) | Character with first message + extra greetings, example dialogs, scenario, tags, creator. Personality becomes readable text; appearance, background, relationships, gender and age are folded into the description |
| Character card JSON (`chara_card_v2`, structured) | Character. `personality` (a JSON object inside a string) becomes readable text; appearance, background, relationships and gender are folded into the description instead of being lost |
| "Detailed" character JSON | Character with first message, extra greetings, example dialogs, scenario, tags |
| Freeform character | Character (freeform text kept as the description) |
| `.png` card (`chara` / `ccv3` chunk) | Same as the card JSON above: the embedded JSON is read from the PNG |
| `.txt` full export (markdown) | Parsed by section: description, tags, author, personality, first messages, example dialogs, connections (as relationships). It has no appearance/background/scenario, so **the `.json`/`.png` gives a more complete character** |
| other `.txt` | Freeform: name from `# Title` / `Name:` / filename, the whole text as description |
| Lorebook JSON | World book with all entries (keys, secondary keys, constant, order, position) |
| Card with an embedded standard V2 `character_book` | Character + attached world book |

Avatar: for a `.png` the card image itself becomes the avatar; for a link, LoreBary's cover; for a `.json` only if it embeds a `coverImage`. If setting it fails the character is still imported and the result line says so. Limits: the `spectrums` sliders are dropped (axis meaning is undocumented),.

## Install / Instalação

Lumiverse → Extensions panel → install from GitHub URL:

```
https://github.com/marmegarei/lumiverse-lorebary-importer
```

Grant the `characters` and `world_books` permissions. Then open **Lorebary** in the sidebar (or `Ctrl+K`), pick one or more `.json`, `.png` or `.txt` files.

## Develop

```bash
bun install
bun test          # converter tests
bun run typecheck
bun run build     # writes dist/ (committed, so Lumiverse can install without building)
```

`src/convert.ts` is a pure function (`convert(text)`), easy to reuse or extend. Formats were derived from public LoreBary export samples; if an export fails, open an issue with a redacted sample.
