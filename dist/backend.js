// @bun
// src/convert.ts
var isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var str = (v) => typeof v === "string" ? v : "";
var strs = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : [];
var label = (k) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
function render(v, skip = [], depth = 0) {
  if (typeof v === "string")
    return v.trim();
  if (typeof v === "number")
    return String(v);
  if (Array.isArray(v)) {
    const items = v.map((x) => render(x, skip, depth + 1)).filter(Boolean);
    return items.every((s) => !s.includes(`
`)) ? items.join(", ") : items.map((s) => `- ${s}`).join(`
`);
  }
  if (!isObj(v))
    return "";
  return Object.entries(v).filter(([k]) => !skip.includes(k)).map(([k, x]) => {
    if (x === true)
      return `${label(k)}: yes`;
    const t = render(x, skip, depth + 1);
    if (!t)
      return "";
    return t.includes(`
`) || isObj(x) ? `${label(k)}:
${t}` : `${label(k)}: ${t}`;
  }).filter(Boolean).join(`
`);
}
var SKIP = ["spectrums", "hasTraumas", "hasRecord"];
var section = (title, body) => body ? `

[${title}]
${body}` : "";
function personalityText(p) {
  if (typeof p === "string" && p.trim().startsWith("{")) {
    try {
      p = JSON.parse(p);
    } catch {}
  }
  return render(p, SKIP);
}
function relationshipsText(r) {
  if (!Array.isArray(r))
    return "";
  return r.filter(isObj).map((x) => `- ${str(x.name)} (${[str(x.type), str(x.status)].filter(Boolean).join(", ")}): ${str(x.description)}`).join(`
`);
}
function extras(l) {
  return section("Appearance", str(l.appearance).trim()) + section("Background", render(l.background, SKIP)) + section("Relationships", relationshipsText(l.relationships)) + section("Gender", str(l.gender)) + section("Age", str(l.age));
}
function fromCard(root) {
  const d = isObj(root.data) ? root.data : {};
  const l = isObj(d.extensions?.lorebary) ? d.extensions.lorebary : {};
  const structured = typeof d.personality === "string" && d.personality.trim().startsWith("{");
  const ext = { ...d.extensions };
  delete ext.lorebary;
  const out = {
    character: {
      name: str(d.name) || "Unnamed",
      description: (str(d.description) + (l.isFreeForm ? "" : extras(l))).trimEnd(),
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
      extensions: ext
    }
  };
  if (isObj(d.character_book) && Array.isArray(d.character_book.entries)) {
    out.book = {
      name: str(d.character_book.name) || `${out.character.name} Lorebook`,
      description: str(d.character_book.description),
      entries: d.character_book.entries.filter(isObj).map((e) => ({
        key: strs(e.keys),
        keysecondary: strs(e.secondary_keys),
        content: str(e.content),
        comment: str(e.comment) || str(e.name),
        constant: !!e.constant,
        selective: !!e.selective,
        disabled: e.enabled === false,
        order_value: Number(e.insertion_order ?? e.priority ?? 100)
      }))
    };
  }
  return out;
}
function fromDetailed(r) {
  const msgs = (Array.isArray(r.initialMessages) ? r.initialMessages : []).filter((m) => isObj(m) && m.isEnabled !== false && str(m.content)).map((m) => m.content);
  const dialogs = (Array.isArray(r.exampleDialogs) ? r.exampleDialogs : []).filter((x) => isObj(x) && (str(x.userMessage) || str(x.characterResponse))).map((x) => `<START>
{{user}}: ${str(x.userMessage)}
{{char}}: ${str(x.characterResponse)}`);
  const free = r.isFreeForm ? str(r.freeFormContent) : "";
  return {
    character: {
      name: str(r.name) || "Unnamed",
      description: free || (str(r.description) + extras(r)).trimEnd(),
      personality: free ? "" : personalityText(r.personality),
      scenario: isObj(r.scenario) && r.scenario.enabled ? str(r.scenario.content) : "",
      first_mes: msgs[0] ?? "",
      alternate_greetings: msgs.slice(1),
      mes_example: dialogs.join(`
`),
      creator: str(r.author),
      tags: strs(r.tags)
    }
  };
}
function fromLorebook(r) {
  const entries = Object.values(r.entries).filter(isObj).map((e) => ({
    key: strs(e.key),
    keysecondary: strs(e.keysecondary),
    content: str(e.content),
    comment: str(e.comment) || strs(e.key)[0] || "",
    constant: !!e.constant,
    selective: !!e.selective && strs(e.keysecondary).length > 0,
    disabled: !!e.disable,
    order_value: Number(e.order ?? 100),
    position: Number(e.position ?? 0)
  }));
  return { book: { name: str(r.name) || "Lorebary Lorebook", description: str(r.description), entries } };
}
function convert(text) {
  let r;
  try {
    r = JSON.parse(text);
  } catch {
    throw new Error("Not valid JSON.");
  }
  if (!isObj(r))
    throw new Error("Unexpected JSON: expected an object.");
  if (isObj(r.entries) && !("spec" in r))
    return fromLorebook(r);
  if (isObj(r.data) && typeof r.spec === "string")
    return fromCard(r);
  if (isObj(r.meta) && typeof r.meta.name === "string" && (isObj(r.personality) || ("initialMessages" in r) || ("freeFormContent" in r))) {
    return fromDetailed({ ...r.meta, ...r });
  }
  if (typeof r.name === "string" && (("initialMessages" in r) || isObj(r.personality) || ("freeFormContent" in r)))
    return fromDetailed(r);
  throw new Error("Unrecognized format: not a Lorebary character, card or lorebook JSON.");
}
var subs = (md = "") => md.split(/^### /m).slice(1).map((b) => {
  const nl = b.indexOf(`
`);
  return nl < 0 ? [b.trim(), ""] : [b.slice(0, nl).trim(), b.slice(nl + 1).trim()];
});
function fromMarkdown(body, name) {
  const parts = body.split(/^## /m);
  const sec = {};
  for (const p of parts.slice(1)) {
    const nl = p.indexOf(`
`);
    sec[p.slice(0, nl < 0 ? undefined : nl).trim().toLowerCase()] = nl < 0 ? "" : p.slice(nl + 1).trim();
  }
  const tagLine = /^\*\*Tags:\*\*[ \t]*(.*)$/m;
  const desc = sec["description"] ?? "";
  const msgs = subs(sec["first messages"]).map((s) => s[1]).filter(Boolean);
  const dialogs = subs(sec["example dialogs"]).flatMap(([, b]) => {
    const m = b.match(/^\*\*User:\*\*[ \t]*([\s\S]*?)\n\*\*(?!User:)[^*\n]+:\*\*[ \t]*([\s\S]*)$/);
    return m ? [`<START>
{{user}}: ${m[1].trim()}
{{char}}: ${m[2].trim()}`] : [];
  });
  const links = subs(sec["connections"]).map(([t, b]) => `- ${t}: ${b}`).join(`
`);
  return {
    character: {
      name,
      description: (desc.replace(tagLine, "").trim() + section("Relationships", links)).trim(),
      personality: sec["personality"] ?? "",
      first_mes: msgs[0] ?? "",
      alternate_greetings: msgs.slice(1),
      mes_example: dialogs.join(`
`),
      creator: body.match(/^\*\*Author:\*\*[ \t]*(.+)$/m)?.[1].trim() ?? "",
      tags: (desc.match(tagLine)?.[1] ?? "").split(",").map((t) => t.trim()).filter(Boolean)
    }
  };
}
function convertText(text, filename = "") {
  const body = text.replace(/^\uFEFF/, "").trim();
  if (body.startsWith("{"))
    return convert(body);
  if (!body)
    throw new Error("Empty file.");
  const name = body.match(/^#\s+(.+)$/m)?.[1].trim() ?? body.match(/^(?:name|nome)\s*:\s*(.+)$/im)?.[1].trim() ?? (filename.replace(/\.[^.]+$/, "") || "Unnamed");
  if (/^## (description|personality)/im.test(body))
    return fromMarkdown(body, name);
  return { character: { name, description: body } };
}

// src/backend.ts
spindle.onFrontendMessage(async (payload, userId) => {
  if (payload?.type !== "import")
    return;
  const reply = (msg) => spindle.sendToFrontend({ ...msg, id: payload.id }, userId);
  try {
    const { character, book } = payload.filename ? convertText(String(payload.text ?? ""), payload.filename) : convert(String(payload.text ?? ""));
    let bookId;
    if (book) {
      const created = await spindle.world_books.create({ name: book.name, description: book.description }, userId);
      bookId = created.id;
      for (const entry of book.entries)
        await spindle.world_books.entries.create(bookId, entry, userId);
    }
    if (character) {
      await spindle.characters.create({ ...character, ...bookId && { world_book_ids: [bookId] } }, userId);
    }
    const what = character ? character.name : book.name;
    reply({ type: "result", ok: true, message: `${what}${book ? ` (${book.entries.length} lore entries)` : ""}` });
  } catch (err) {
    reply({ type: "result", ok: false, message: err?.message ?? String(err) });
  }
});
spindle.log.info("Lorebary Importer loaded");
