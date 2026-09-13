/**
 * The `media` file in an .apkg maps the numeric zip entries (`0`, `1`, …) to
 * real filenames. Two formats exist:
 *   - old: plain JSON `{ "0": "a.jpg", "1": "b.png" }`
 *   - new: zstd-compressed protobuf (`MediaEntries { repeated MediaEntry }`)
 * This only needs the filename per index, so the protobuf reader is minimal.
 */

/** Read a base-128 varint. Returns [value, nextOffset]. */
function readVarint(buf: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  for (;;) {
    const byte = buf[pos];
    pos += 1;
    result += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return [result, pos];
}

/** Parse `MediaEntries` → array of names, index-aligned with the zip entries. */
function parseProtobuf(buf: Uint8Array): string[] {
  const names: string[] = [];
  let pos = 0;
  while (pos < buf.length) {
    const [tag, afterTag] = readVarint(buf, pos);
    const field = tag >>> 3;
    const wire = tag & 0x7;
    pos = afterTag;
    if (wire !== 2) {
      // Not a length-delimited field we care about — skip it.
      if (wire === 0) [, pos] = readVarint(buf, pos);
      else if (wire === 5) pos += 4;
      else if (wire === 1) pos += 8;
      continue;
    }
    const [len, afterLen] = readVarint(buf, pos);
    pos = afterLen;
    const chunk = buf.subarray(pos, pos + len);
    pos += len;

    if (field === 1) {
      // repeated MediaEntry entries = 1;  → read its `name` (field 1, string)
      let e = 0;
      while (e < chunk.length) {
        const [etag, afterEtag] = readVarint(chunk, e);
        const efield = etag >>> 3;
        const ewire = etag & 0x7;
        e = afterEtag;
        if (ewire === 2) {
          const [elen, afterElen] = readVarint(chunk, e);
          e = afterElen;
          if (efield === 1) {
            names.push(new TextDecoder().decode(chunk.subarray(e, e + elen)));
          }
          e += elen;
        } else if (ewire === 0) {
          [, e] = readVarint(chunk, e);
        } else if (ewire === 5) {
          e += 4;
        } else if (ewire === 1) {
          e += 8;
        } else {
          break;
        }
      }
    }
  }
  return names;
}

export interface MediaMap {
  /** zip entry name (`"0"`, `"1"`, …) → real filename */
  byIndex: Map<string, string>;
}

/**
 * @param raw   the decompressed `media` file bytes
 * @param wasZstd  whether it was zstd-compressed (⇒ protobuf), else JSON
 */
export function parseMediaManifest(raw: Uint8Array, wasZstd: boolean): MediaMap {
  const byIndex = new Map<string, string>();

  if (!wasZstd) {
    try {
      const json = JSON.parse(new TextDecoder().decode(raw)) as Record<
        string,
        string
      >;
      for (const [k, v] of Object.entries(json)) byIndex.set(k, v);
      return { byIndex };
    } catch {
      /* fall through to protobuf */
    }
  }

  const names = parseProtobuf(raw);
  names.forEach((name, i) => byIndex.set(String(i), name));
  return { byIndex };
}
