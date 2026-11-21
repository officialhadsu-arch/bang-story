var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// bukti-naskah-per-bagian/entry-logika.ts
var entry_logika_exports = {};
__export(entry_logika_exports, {
  CUSTOM_DURATION_MAX_SEC: () => CUSTOM_DURATION_MAX_SEC,
  CUSTOM_DURATION_MIN_SEC: () => CUSTOM_DURATION_MIN_SEC,
  DURATIONS: () => DURATIONS,
  GEMINI_LIBRARY_VOICES: () => GEMINI_LIBRARY_VOICES,
  GEMINI_VOICES: () => GEMINI_VOICES,
  LANGUAGES: () => LANGUAGES,
  LLM_PROVIDERS: () => LLM_PROVIDERS,
  SCRIPT_CHUNK_SIZE: () => SCRIPT_CHUNK_SIZE,
  VOICE_PAD_MS: () => VOICE_PAD_MS,
  clipCountFor: () => clipCountFor,
  estimateNarrationMs: () => estimateNarrationMs,
  geminiVoiceName: () => geminiVoiceName,
  geminiVoiceTone: () => geminiVoiceTone,
  isDoubtfulScene: () => isDoubtfulScene,
  llmName: () => llmName,
  needsVisual: () => needsVisual,
  parseCustomDuration: () => parseCustomDuration,
  scriptChunkRanges: () => scriptChunkRanges,
  visualSourceOf: () => visualSourceOf,
  wordCount: () => wordCount
});
module.exports = __toCommonJS(entry_logika_exports);

// src/shared/models.ts
var LLM_PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    note: "Kunci ini juga dipakai untuk suara narator Gemini TTS.",
    link: "https://aistudio.google.com/apikey",
    linkLabel: "Buat kunci di Google AI Studio"
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    note: "Satu kunci untuk ratusan model dari banyak penyedia, termasuk model gratis.",
    link: "https://openrouter.ai/settings/keys",
    linkLabel: "Buat kunci di OpenRouter"
  },
  {
    id: "groq",
    name: "Groq",
    note: "Inferensi sangat cepat untuk model open-source seperti Llama, Qwen, dan GPT-OSS.",
    link: "https://console.groq.com/keys",
    linkLabel: "Buat kunci di console Groq"
  },
  {
    id: "custom",
    name: "Endpoint custom",
    note: "Server apa pun yang kompatibel dengan OpenAI API, misalnya Ollama, LM Studio, vLLM, DeepSeek, atau xAI Grok.",
    link: null,
    linkLabel: ""
  }
];
function llmName(id) {
  return LLM_PROVIDERS.find((p) => p.id === id)?.name ?? id;
}
var GEMINI_LIBRARY_VOICES = [
  { id: "en-us-arlo", name: "Arlo", tone: "asisten pribadi" },
  { id: "en-us-bodi", name: "Bodi", tone: "pengajar sastra" },
  { id: "en-us-brio", name: "Brio", tone: "pembaca berita bisnis" },
  { id: "en-us-cruz", name: "Cruz", tone: "penasihat keuangan" },
  { id: "en-us-daro", name: "Daro", tone: "layanan pelanggan, empatik" },
  { id: "en-us-elio", name: "Elio", tone: "formal, resmi" },
  { id: "en-us-enya", name: "Enya", tone: "pemandu teknis" },
  { id: "en-us-enzo", name: "Enzo", tone: "pencerita petualangan" },
  { id: "en-us-finn", name: "Finn", tone: "asisten pribadi" },
  { id: "en-us-fola", name: "Fola", tone: "layanan pelanggan" },
  { id: "en-us-gero", name: "Gero", tone: "hangat, menenangkan" },
  { id: "en-us-hali", name: "Hali", tone: "layanan pelanggan" },
  { id: "en-us-jett", name: "Jett", tone: "pemandu teknis" },
  { id: "en-us-lora", name: "Lora", tone: "concierge elegan" },
  { id: "en-us-ludo", name: "Ludo", tone: "pengajar teknologi" },
  { id: "en-us-lumi", name: "Lumi", tone: "pengajar sastra" },
  { id: "en-us-mako", name: "Mako", tone: "presentasi produk" },
  { id: "en-us-neno", name: "Neno", tone: "lembut, pendengar" },
  { id: "en-us-nika", name: "Nika", tone: "lembut, pendengar" },
  { id: "en-us-nyla", name: "Nyla", tone: "pemandu teknis" },
  { id: "en-us-rami", name: "Rami", tone: "pembaca berita" },
  { id: "en-us-riko", name: "Riko", tone: "pencerita fantasi" },
  { id: "en-us-rina", name: "Rina", tone: "hangat, menenangkan" },
  { id: "en-us-tari", name: "Tari", tone: "tenang, menenangkan" },
  { id: "en-us-tavi", name: "Tavi", tone: "concierge elegan" },
  { id: "en-us-tova", name: "Tova", tone: "formal, resmi" },
  { id: "en-us-varo", name: "Varo", tone: "pengajar matematika" },
  { id: "en-us-veda", name: "Veda", tone: "pembaca berita" },
  { id: "en-us-zali", name: "Zali", tone: "dramatis, fantasi gelap" },
  { id: "en-us-zeno", name: "Zeno", tone: "pembawa acara" }
];
function geminiVoiceTone(id) {
  return GEMINI_LIBRARY_VOICES.find((v) => v.id === id)?.tone ?? GEMINI_VOICES.find((v) => v.id === id)?.tone;
}
function geminiVoiceName(id) {
  return GEMINI_LIBRARY_VOICES.find((v) => v.id === id)?.name ?? id;
}
var GEMINI_VOICES = [
  { id: "Charon", tone: "informatif" },
  { id: "Kore", tone: "tegas" },
  { id: "Puck", tone: "ceria" },
  { id: "Zephyr", tone: "cerah" },
  { id: "Fenrir", tone: "bersemangat" },
  { id: "Leda", tone: "muda" },
  { id: "Orus", tone: "tegas" },
  { id: "Aoede", tone: "santai" },
  { id: "Callirrhoe", tone: "santai" },
  { id: "Autonoe", tone: "cerah" },
  { id: "Enceladus", tone: "berbisik" },
  { id: "Iapetus", tone: "jernih" },
  { id: "Umbriel", tone: "santai" },
  { id: "Algieba", tone: "halus" },
  { id: "Despina", tone: "halus" },
  { id: "Erinome", tone: "jernih" },
  { id: "Algenib", tone: "serak" },
  { id: "Rasalgethi", tone: "informatif" },
  { id: "Laomedeia", tone: "ceria" },
  { id: "Achernar", tone: "lembut" },
  { id: "Alnilam", tone: "tegas" },
  { id: "Schedar", tone: "stabil" },
  { id: "Gacrux", tone: "dewasa" },
  { id: "Pulcherrima", tone: "lugas" },
  { id: "Achird", tone: "ramah" },
  { id: "Zubenelgenubi", tone: "kasual" },
  { id: "Vindemiatrix", tone: "lembut" },
  { id: "Sadachbia", tone: "hidup" },
  { id: "Sadaltager", tone: "berwawasan" },
  { id: "Sulafat", tone: "hangat" }
];
var LANGUAGES = [
  { code: "id", label: "Indonesia", english: "Indonesian" },
  { code: "en", label: "English", english: "English" },
  { code: "ms", label: "Melayu", english: "Malay" },
  { code: "jv", label: "Jawa", english: "Javanese" },
  { code: "su", label: "Sunda", english: "Sundanese" },
  { code: "es", label: "Espa\xF1ol", english: "Spanish" },
  { code: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", english: "Arabic" }
];
var DURATIONS = [
  { sec: 30, label: "30 detik" },
  { sec: 60, label: "1 menit" },
  { sec: 180, label: "3 menit" },
  { sec: 300, label: "5 menit" },
  { sec: 600, label: "10 menit" }
];
var SCRIPT_CHUNK_SIZE = 30;
function clipCountFor(durationSec) {
  return Math.max(3, Math.round(durationSec / 5.5));
}
function scriptChunkRanges(total, chunkSize = SCRIPT_CHUNK_SIZE) {
  const ranges = [];
  for (let start = 1; start <= total; start += chunkSize) ranges.push({ start, end: Math.min(total, start + chunkSize - 1) });
  return ranges;
}
var CUSTOM_DURATION_MIN_SEC = 15;
var CUSTOM_DURATION_MAX_SEC = 1800;
function parseCustomDuration(text) {
  const value = Number(text.trim());
  if (text.trim() === "" || !Number.isFinite(value)) return { error: "Tulis durasi dalam angka, misalnya 90." };
  if (value < CUSTOM_DURATION_MIN_SEC) return { error: `Durasi paling pendek ${CUSTOM_DURATION_MIN_SEC} detik.` };
  if (value > CUSTOM_DURATION_MAX_SEC) return { error: `Durasi paling panjang ${CUSTOM_DURATION_MAX_SEC} detik (30 menit).` };
  return { sec: Math.round(value) };
}

// src/shared/speech.ts
var ANGLE = /<[^<>]{1,40}>/g;
var SQUARE = /\[[^[\]]{1,40}\]/g;
function stripVoiceTags(text) {
  return text.replace(ANGLE, " ").replace(SQUARE, " ").replace(/\s+/g, " ").trim();
}
function spokenWords(text) {
  return stripVoiceTags(text).split(/\s+/).filter(Boolean);
}
function tagPauseSec(text) {
  const short = (text.match(/<short pause>/gi) ?? []).length;
  const long = (text.match(/<long pause>/gi) ?? []).length;
  return short * 0.4 + long * 1;
}

// src/shared/script.ts
var VOICE_PAD_MS = 400;
function estimateNarrationMs(narration) {
  const words = spokenWords(narration).length;
  return Math.round(Math.min(15, Math.max(3, words / 2.6 + 0.6 + tagPauseSec(narration))) * 1e3);
}
function wordCount(text) {
  return spokenWords(text).length;
}
var END_PUNCT = /[.?!…]$/;
function isDoubtfulScene(narration) {
  if (!narration.trim()) return true;
  if (wordCount(narration) < 10) return true;
  const trimmed = narration.replace(/\s+$/, "").replace(/(?:\s*<[^<>]{1,40}>)+\s*$/, "");
  return !END_PUNCT.test(trimmed);
}
function visualSourceOf(clip) {
  return (clip.story.trim() || clip.narration.trim()).replace(/\s+/g, " ");
}
function needsVisual(clip) {
  if (!clip.visualPrompt.trim()) return true;
  return clip.visualSource != null && clip.visualSource !== visualSourceOf(clip);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CUSTOM_DURATION_MAX_SEC,
  CUSTOM_DURATION_MIN_SEC,
  DURATIONS,
  GEMINI_LIBRARY_VOICES,
  GEMINI_VOICES,
  LANGUAGES,
  LLM_PROVIDERS,
  SCRIPT_CHUNK_SIZE,
  VOICE_PAD_MS,
  clipCountFor,
  estimateNarrationMs,
  geminiVoiceName,
  geminiVoiceTone,
  isDoubtfulScene,
  llmName,
  needsVisual,
  parseCustomDuration,
  scriptChunkRanges,
  visualSourceOf,
  wordCount
});
