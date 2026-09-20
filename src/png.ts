// Extract the character-card JSON from a PNG. Cards store it base64-encoded in a tEXt chunk
// named `ccv3` (V3) or `chara` (V2). Browser-safe: no Buffer.
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function pngCardJson(bytes: Uint8Array): string {
  if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error('Not a PNG file.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const found: Record<string, string> = {}
  for (let pos = 8; pos + 12 <= bytes.length; ) {
    const len = view.getUint32(pos)
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8))
    if (type === 'tEXt') {
      const data = bytes.subarray(pos + 8, pos + 8 + len)
      const nul = data.indexOf(0)
      const key = String.fromCharCode(...data.subarray(0, nul))
      if (key === 'ccv3' || key === 'chara') found[key] = String.fromCharCode(...data.subarray(nul + 1))
    }
    if (type === 'IEND') break
    pos += 12 + len // length + type + data + crc
  }
  const b64 = found.ccv3 ?? found.chara
  if (!b64) throw new Error('PNG has no character data (no "chara"/"ccv3" chunk).')
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
}
