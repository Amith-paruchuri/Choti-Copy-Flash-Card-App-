// Build a tiny synthetic .apkg for end-to-end browser testing.
import { writeFileSync } from "node:fs";
import { zipSync } from "fflate";
import initSqlJs from "sql.js";

const SQL = await initSqlJs({
  locateFile: (f) => `./node_modules/sql.js/dist/${f}`,
});
const db = new SQL.Database();

// minimal Anki-ish schema (legacy col.decks / col.models JSON form)
db.run(`
CREATE TABLE col (id integer primary key, crt integer, mod integer, scm integer,
  ver integer, dty integer, usn integer, ls integer, conf text, models text,
  decks text, dconf text, tags text);
CREATE TABLE notes (id integer primary key, guid text, mid integer, mod integer,
  usn integer, tags text, flds text, sfld text, csum integer, flags integer, data text);
CREATE TABLE cards (id integer primary key, nid integer, did integer, ord integer,
  mod integer, usn integer, type integer, queue integer, due integer, ivl integer,
  factor integer, reps integer, lapses integer, left integer, odue integer,
  odid integer, flags integer, data text);
CREATE TABLE revlog (id integer primary key);
CREATE TABLE graves (usn integer, oid integer, type integer);
`);

const BASIC = "1000000000001";
const CLOZE = "1000000000002";
const models = {
  [BASIC]: { id: BASIC, name: "Basic", type: 0, flds: [{ name: "Front" }, { name: "Back" }] },
  [CLOZE]: { id: CLOZE, name: "Cloze", type: 1, flds: [{ name: "Text" }, { name: "Extra" }] },
};
const decks = {
  1: { id: 1, name: "Default" },
  20: { id: 20, name: "Neuro\x1fCranial nerves" },
  30: { id: 30, name: "Neuro\x1fBrainstem" },
};
db.run("INSERT INTO col VALUES (1,0,0,0,11,0,0,0,'{}',?,?,'{}','')", [
  JSON.stringify(models),
  JSON.stringify(decks),
]);

const US = "\x1f";
const notes = [
  { mid: BASIC, did: 20, flds: `Which cranial nerve carries taste from the anterior 2/3 of the tongue?${US}CN VII (facial), via the chorda tympani.` },
  { mid: BASIC, did: 20, flds: `<b>CN III</b> palsy — eye position?${US}"Down and out", with ptosis and a blown pupil.<br><img src="eye.png">` },
  { mid: CLOZE, did: 30, flds: `The {{c1::medulla}} contains the {{c2::respiratory}} centres.${US}Also cardiovascular centres.` },
  { mid: BASIC, did: 1, flds: `Where does CSF get reabsorbed?${US}Arachnoid granulations into the dural venous sinuses.` },
];
let nid = 1500000000000;
let cid = 1500000000000;
for (const n of notes) {
  nid += 1;
  db.run(
    "INSERT INTO notes VALUES (?,?,?,0,0,'',?,?,0,0,'')",
    [nid, "g" + nid, Number(n.mid), n.flds, n.flds.split(US)[0]],
  );
  // one card per note (cloze: still one row here; parser expands by ordinal)
  cid += 1;
  db.run(
    "INSERT INTO cards VALUES (?,?,?,0,0,0,0,0,0,0,0,0,0,0,0,0,0,'')",
    [cid, nid, n.did],
  );
}

const dbBytes = db.export();
db.close();

// a 1x1 red png
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const zip = zipSync({
  "collection.anki21": dbBytes,
  "0": new Uint8Array(png),
  media: new TextEncoder().encode(JSON.stringify({ "0": "eye.png" })),
});
writeFileSync("test-fixtures/synthetic_mini.apkg", zip);
console.log("wrote test-fixtures/synthetic_mini.apkg", zip.length, "bytes");
