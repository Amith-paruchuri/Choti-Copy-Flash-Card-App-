import fs from "node:fs";
const { parseApkg } = await import("./src/lib/anki/parse.ts");
const r = await parseApkg(new Uint8Array(fs.readFileSync("test-fixtures/synthetic_mini.apkg")), { wasmUrl: "./node_modules/sql.js/dist/sql-wasm.wasm" });
console.log("stats:", r.stats);
console.log("warnings:", r.warnings);
for (const d of r.drafts) console.log(d.deckPath.join(" › "), "|", JSON.stringify(d.title.slice(0,60)), "|", JSON.stringify(d.content.slice(0,80)), d.images);
console.log("media:", [...r.media.keys()]);
