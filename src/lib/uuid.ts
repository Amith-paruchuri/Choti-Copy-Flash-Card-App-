/**
 * UUID v4 that also works in an insecure context — plain HTTP to a LAN IP
 * during phone testing, where the browser does NOT expose
 * `crypto.randomUUID()` (secure-context only).
 *
 * `crypto.getRandomValues()` has no such restriction, so we use it directly
 * and only fall back to `Math.random()` if even that is unavailable.
 */
export function uuidv4(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }

  // RFC 4122 §4.4 — set version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return (
    `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-` +
    `${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-` +
    hex.slice(10, 16).join("")
  );
}
