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

// src/shared/script-import.ts
var script_import_exports = {};
__export(script_import_exports, {
  SCRIPT_IMPORT_EXAMPLE: () => SCRIPT_IMPORT_EXAMPLE,
  importDurationMs: () => importDurationMs,
  parseScriptImport: () => parseScriptImport
});
module.exports = __toCommonJS(script_import_exports);

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
function estimateNarrationMs(narration) {
  const words = spokenWords(narration).length;
  return Math.round(Math.min(15, Math.max(3, words / 2.6 + 0.6 + tagPauseSec(narration))) * 1e3);
}

// src/shared/script-import.ts
function importDurationMs(scenes) {
  return scenes.reduce((n, s) => n + estimateNarrationMs(s.narration), 0);
}
var LABEL_RE = /^(alur|narasi)\s*:\s*(.*)$/i;
var NUMBER_RE = /^\d+\s*[.)]\s*/;
var TITLE_RE = /^#\s+(.*)$/;
function parseScriptImport(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let title = null;
  const scenes = [];
  const skipped = [];
  let totalScenes = 0;
  let current = null;
  const finishScene = () => {
    if (!current) return;
    totalScenes += 1;
    const story = current.story.replace(/\s+/g, " ").trim();
    const narration = current.narration.replace(/\s+/g, " ").trim();
    if (!story && !narration) {
      skipped.push(totalScenes);
    } else {
      scenes.push({ title: current.title || `Adegan ${totalScenes}`, story, narration });
    }
    current = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("##")) {
      finishScene();
      const heading = line.replace(/^#+\s*/, "");
      current = { title: heading.replace(NUMBER_RE, "").trim(), story: "", narration: "", field: "narration" };
      continue;
    }
    if (!current && title === null) {
      const m = TITLE_RE.exec(line);
      if (m && m[1].trim()) {
        title = m[1].trim();
        continue;
      }
    }
    if (!current) continue;
    const label = LABEL_RE.exec(line);
    if (label) {
      current.field = label[1].toLowerCase() === "alur" ? "story" : "narration";
      const rest = label[2].trim();
      if (rest) current[current.field] += `${current[current.field] ? "\n" : ""}${rest}`;
      continue;
    }
    current[current.field] += `${current[current.field] ? "\n" : ""}${line}`;
  }
  finishScene();
  return { title, scenes, skipped, totalScenes };
}
var SCRIPT_IMPORT_EXAMPLE = `# Kisah Sumpah Palapa
## 1. Senja di Majapahit
Alur: Senja turun di ibu kota Majapahit dan istana bersiap untuk upacara penting.
Narasi: Tahun 1336. Senja turun di ibu kota Majapahit, dan istana bersiap untuk upacara penting.
## 2. Sumpah Palapa
Alur: Gajah Mada melangkah maju dan mengucapkan sumpahnya di depan para menteri.
Narasi: Aku tidak akan menikmati palapa, sebelum Nusantara bersatu.`;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SCRIPT_IMPORT_EXAMPLE,
  importDurationMs,
  parseScriptImport
});
