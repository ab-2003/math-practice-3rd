/**
 * RECORD THE RIVALS' TRASH TALK through ElevenLabs, once.
 *
 *   npx vite-node tools/voice-lines.ts [--voices a,b,c] [--force] [--model eleven_v3] [--max 4]
 *
 * The key comes from ELEVENLABS_API_KEY, or from ~/.elevenlabs-api.key (the
 * file the other games read; never in the repo). The script:
 *
 *   1. lists the account's voices and keeps the BRITISH ones (by the voice's
 *      own accent label), up to four, unless --voices names them;
 *   2. for each voice and each of the thirty lines in core/duel.ts, asks
 *      for an MP3 with an expressive, cheeky delivery and writes it to
 *      public/voice/<slug>/<n>.mp3, skipping clips already on disk;
 *   3. writes the VOICES list into src/core/voices.ts.
 *
 * Idempotent: run it again and only missing clips are fetched. A changed
 * line (a different index or text) needs --force for that voice, or just
 * delete the clip. Nothing here runs in the app; the app only plays files.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { TRASH_TALK } from "../src/core/duel";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = join(ROOT, "public", "voice");
const VOICES_TS = join(ROOT, "src", "core", "voices.ts");
const API = "https://api.elevenlabs.io/v1";

const args = process.argv.slice(2);
const flag = (name: string): string | null => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] ?? null : null; };
const FORCE = args.includes("--force");
const WANT = flag("--voices")?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) ?? null;
const MODEL = flag("--model") ?? "eleven_v3";
const MAX_VOICES = Number(flag("--max") ?? 4);
/** An audio tag before every line (eleven_v3 reads it as a direction, not
 *  aloud): the cheek. --tag "" for none. */
const TAG = flag("--tag") ?? "[mischievously]";

const keyFile = join(homedir(), ".elevenlabs-api.key");
const KEY = process.env["ELEVENLABS_API_KEY"] ?? (existsSync(keyFile) ? readFileSync(keyFile, "utf8").trim() : "");
if (!KEY) {
  console.error(`no key: set ELEVENLABS_API_KEY or put it in ${keyFile}`);
  process.exit(2);
}

interface ApiVoice { voice_id: string; name: string; category?: string; labels?: Record<string, string>; description?: string }

/** "George - Warm, Captivating Storyteller" is the folder "george". */
const shortName = (name: string): string => name.split(" - ")[0]!.trim();
const slugOf = (name: string): string => shortName(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const isBritish = (v: ApiVoice): boolean => {
  const bag = `${v.labels?.["accent"] ?? ""} ${v.labels?.["description"] ?? ""} ${v.description ?? ""}`.toLowerCase();
  return /british|english|london|cockney|scottish|welsh|irish|northern/.test(bag) && !/american|australian/.test(v.labels?.["accent"] ?? "");
};

const listVoices = async (): Promise<ApiVoice[]> => {
  const r = await fetch(`${API}/voices`, { headers: { "xi-api-key": KEY } });
  if (!r.ok) throw new Error(`voices: ${r.status} ${await r.text()}`);
  const j = (await r.json()) as { voices: ApiVoice[] };
  return j.voices;
};

/** One line, one voice: the MP3 bytes. v3 takes the cheek as a tag; the
 *  older models take it as expressive voice settings. */
const speak = async (voiceId: string, text: string, model: string): Promise<Buffer> => {
  const v3 = model.startsWith("eleven_v3");
  const r = await fetch(`${API}/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text: v3 && TAG ? `${TAG} ${text}` : text,
      model_id: model,
      ...(v3 ? {} : { voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true } }),
    }),
  });
  if (!r.ok) throw new Error(`tts ${voiceId} (${model}): ${r.status} ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
};

const main = async (): Promise<void> => {
  const all = await listVoices();
  let chosen: ApiVoice[];
  if (WANT !== null) {
    chosen = WANT.map((w) => all.find((v) => v.name.toLowerCase() === w || v.voice_id === w || slugOf(v.name) === w)).filter((v): v is ApiVoice => v !== undefined);
    const missing = WANT.filter((w) => !chosen.some((v) => v.name.toLowerCase() === w || v.voice_id === w || slugOf(v.name) === w));
    if (missing.length > 0) console.warn(`not in the account: ${missing.join(", ")}`);
  } else {
    chosen = all.filter(isBritish).slice(0, MAX_VOICES);
  }
  if (chosen.length === 0) {
    console.error("no voices chosen. The account has:");
    for (const v of all) console.error(`  ${v.name.padEnd(18)} ${v.voice_id}  ${v.labels?.["accent"] ?? ""}  ${v.labels?.["description"] ?? ""}`);
    process.exit(1);
  }
  console.log(`recording ${TRASH_TALK.length} lines in ${chosen.length} voice(s) with ${MODEL}: ${chosen.map((v) => `${v.name} (${v.labels?.["accent"] ?? "?"})`).join(", ")}`);

  let fetched = 0; let kept = 0;
  for (const v of chosen) {
    const dir = join(OUT, slugOf(v.name));
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < TRASH_TALK.length; i++) {
      const file = join(dir, `${i}.mp3`);
      if (!FORCE && existsSync(file) && statSync(file).size > 1000) { kept += 1; continue; }
      const bytes = await speak(v.voice_id, TRASH_TALK[i]!, MODEL);
      writeFileSync(file, bytes);
      fetched += 1;
      process.stdout.write(`  ${v.name} ${i + 1}/${TRASH_TALK.length}\r`);
    }
    console.log(`  ${v.name}: done`.padEnd(40));
  }

  const entries = chosen.map((v) => `  { slug: "${slugOf(v.name)}", name: "${shortName(v.name).replace(/"/g, "'")}", accent: "${(v.labels?.["accent"] ?? "british").replace(/"/g, "'")}" },`).join("\n");
  const src = readFileSync(VOICES_TS, "utf8");
  const start = src.indexOf("export const VOICES: readonly Voice[] = [");
  const end = src.indexOf("];", start);
  if (start < 0 || end < 0) throw new Error("voices.ts has no VOICES block to fill");
  writeFileSync(VOICES_TS, `${src.slice(0, start)}export const VOICES: readonly Voice[] = [\n${entries}\n${src.slice(end)}`);
  console.log(`fetched ${fetched}, kept ${kept}; VOICES written to src/core/voices.ts`);
};

void main().catch((e: unknown) => { console.error(String(e)); process.exit(1); });
