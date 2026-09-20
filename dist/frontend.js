// src/png.ts
var latin1 = new TextDecoder("latin1");
var SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
function pngCardJson(bytes) {
  if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b))
    throw new Error("Not a PNG file.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found = {};
  for (let pos = 8;pos + 12 <= bytes.length; ) {
    const len = view.getUint32(pos);
    const type = latin1.decode(bytes.subarray(pos + 4, pos + 8));
    if (type === "tEXt") {
      const data = bytes.subarray(pos + 8, pos + 8 + len);
      const nul = data.indexOf(0);
      const key = latin1.decode(data.subarray(0, nul));
      if (key === "ccv3" || key === "chara")
        found[key] = latin1.decode(data.subarray(nul + 1));
    }
    if (type === "IEND")
      break;
    pos += 12 + len;
  }
  const b64 = found.ccv3 ?? found.chara;
  if (!b64)
    throw new Error('PNG has no character data (no "chara"/"ccv3" chunk).');
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

// src/frontend.ts
function setup(ctx) {
  const tab = ctx.ui.registerDrawerTab({
    id: "import",
    title: "Lorebary Importer",
    shortName: "Lorebary",
    description: "Import LoreBary characters by link or file",
    keywords: ["lorebary", "import", "janitor", "character", "lorebook"]
  });
  const links = document.createElement("textarea");
  links.placeholder = "Paste LoreBary link(s), e.g. https://lorebary.com/character-marketplace?view=7DFB7D95 (one per line)";
  links.rows = 3;
  links.style.cssText = "width:100%;margin-bottom:6px;box-sizing:border-box";
  const go = document.createElement("button");
  go.textContent = "Import from link(s)";
  go.style.marginBottom = "12px";
  const pick = document.createElement("button");
  pick.textContent = "Choose Lorebary file(s) (.json, .png, .txt)…";
  const log = document.createElement("div");
  log.style.cssText = "margin-top:8px;font-size:12px;white-space:pre-wrap;color:var(--lumiverse-text-muted)";
  tab.root.style.padding = "12px";
  tab.root.append(links, go, document.createElement("br"), pick, log);
  const names = new Map;
  const line = (t) => log.append(t + `
`);
  go.onclick = () => {
    for (const link of links.value.split(/\s+/).filter(Boolean)) {
      const id = crypto.randomUUID();
      names.set(id, link.replace(/^https?:\/\/(www\.)?/, ""));
      ctx.sendToBackend({ type: "import_url", id, url: link });
    }
    links.value = "";
  };
  pick.onclick = async () => {
    try {
      const files = await ctx.uploads.pickFile({ accept: [".json", ".png", ".txt", "application/json", "image/png", "text/plain"], multiple: true, maxSizeBytes: 20 * 1024 * 1024 });
      for (const f of files) {
        const id = crypto.randomUUID();
        names.set(id, f.name);
        try {
          const png = /\.png$/i.test(f.name);
          const text = png ? pngCardJson(f.bytes) : new TextDecoder().decode(f.bytes);
          ctx.sendToBackend({ type: "import", id, text, filename: /\.txt$/i.test(f.name) ? f.name : undefined });
        } catch (e) {
          line(`✗ ${f.name}: ${e?.message ?? e}`);
        }
      }
    } catch (e) {
      line(`✗ ${e?.message ?? e}`);
    }
  };
  const unsub = ctx.onBackendMessage((p) => {
    if (p?.type !== "result")
      return;
    line(`${p.ok ? "✓" : "✗"} ${names.get(p.id) ?? ""}: ${p.message}`);
  });
  return () => {
    unsub();
    tab.destroy();
  };
}
export {
  setup
};
