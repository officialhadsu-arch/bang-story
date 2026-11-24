// Service test for tier 2 shared helpers (no app, no network): scene keys, work-file
// matching, numbered prompts + manifest, and the shared prompt builders.
import { buildWorkFolderContent, formatSceneKey, matchWorkFile, nextSceneKey, sceneKeyOf } from '@shared/manual'
import { clipPrompt, splitAvoid, videoPromptForClip } from '@shared/prompts'
import type { Character, Clip, Project } from '@shared/types'

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    pass++
    console.log(`PASS ${name}`)
  } else {
    fail++
    console.log(`FAIL ${name} ${extra !== undefined ? JSON.stringify(extra) : ''}`)
  }
}
function eq<T>(name: string, got: T, want: T): void {
  check(name, JSON.stringify(got) === JSON.stringify(want), { got, want })
}

// --- scene keys ---
eq('formatSceneKey 1', formatSceneKey(1), '01')
eq('formatSceneKey 12', formatSceneKey(12), '12')
eq('formatSceneKey 100', formatSceneKey(100), '100')
eq('sceneKeyOf 0', sceneKeyOf(0), '01')
eq('nextSceneKey empty', nextSceneKey([]), '01')
eq('nextSceneKey max+1', nextSceneKey(['01', '02', '04']), '05')
eq('nextSceneKey ignores junk', nextSceneKey(['', 'xx', '03']), '04')

// --- work-file matching (D2-04) ---
eq('match 03.png', matchWorkFile('03.png'), { sceneKey: '03', kind: 'image', ext: 'png' })
eq('match 03-v2.mp4', matchWorkFile('03-v2.mp4'), { sceneKey: '03', kind: 'video', ext: 'mp4' })
eq('match scene-03.png', matchWorkFile('scene-03.png'), { sceneKey: '03', kind: 'image', ext: 'png' })
eq('match clip-12.mp4', matchWorkFile('clip-12.mp4'), { sceneKey: '12', kind: 'video', ext: 'mp4' })
eq('match 3.png pads', matchWorkFile('3.png'), { sceneKey: '03', kind: 'image', ext: 'png' })
eq('match 03.PNG case', matchWorkFile('03.PNG'), { sceneKey: '03', kind: 'image', ext: 'png' })
eq('no match name-first', matchWorkFile('gajah-mada.png'), null)
eq('no match txt', matchWorkFile('03.txt'), null)
eq('no match no ext', matchWorkFile('03'), null)
eq('no match digits later', matchWorkFile('v2-03.png'), null)

// --- prompt builders ---
const project = {
  id: 'p1',
  title: 'Demo',
  synopsis: '',
  durationSec: 30,
  language: 'id',
  aspectRatio: '16:9',
  styleId: 'stickman',
  ttsProvider: 'gemini',
  ttsVoice: 'Charon',
  imageModel: null,
  videoModel: null,
  videoResolution: null,
  status: 'storyboard',
  step: 3,
  coverAssetId: null,
  editor: { captionStyle: 'karaoke', captionPosition: 'bawah', captionSize: 'sedang', musicAssetId: null, musicVolumeDb: -18, duckMusic: true, overlays: [] },
  createdAt: 0,
  updatedAt: 0
} as Project
const clip = {
  id: 'c1',
  projectId: 'p1',
  sort: 0,
  sceneKey: '01',
  visualProvider: 'manual',
  title: 'Senja di Majapahit',
  story: '',
  visualPrompt: 'Setting: istana Majapahit saat senja\nAction: patih melangkah maju\nAvoid: Earth landscape',
  visualSource: null,
  narration: '',
  durationMs: 5000,
  characterIds: [],
  motionType: 'camera',
  cameraPreset: 'zoomin',
  motionStrength: 'halus',
  videoPrompt: '',
  transition: 'fade',
  videoCamera: 'static',
  videoStrength: 'halus',
  transitionMs: null,
  voiceGainDb: 0,
  mediaInMs: 0,
  voiceInMs: 0,
  voiceOutMs: null,
  voiceStartMs: 0,
  imageAssetId: null,
  videoAssetId: null,
  audioAssetId: null
} as Clip

eq('splitAvoid scene', splitAvoid(clip.visualPrompt).scene, 'Setting: istana Majapahit saat senja\nAction: patih melangkah maju')
eq('splitAvoid avoid', splitAvoid(clip.visualPrompt).avoid, 'Earth landscape')
const p = clipPrompt(project, clip, [], [], 4000)
check('clipPrompt has scene', p.includes('istana Majapahit'))
check('clipPrompt has avoid as instruction', p.includes('Must not appear in the image: Earth landscape.'))
check('clipPrompt has aspect', p.includes('Frame format 16:9'))
eq('videoPrompt default derives from scene', videoPromptForClip(clip, false).startsWith('Setting: istana Majapahit saat senja'), true)
check('videoPrompt default has motion', videoPromptForClip(clip, false).includes('Subtle natural motion'))
eq('videoPrompt custom kept', videoPromptForClip({ ...clip, videoPrompt: '  Kamera mendekat pelan  ' }, false), 'Kamera mendekat pelan')
check('videoPrompt reference prefix', videoPromptForClip(clip, true).startsWith('Open on the exact scene of the reference image'))

// --- work-folder content (D2-04, D2-05) ---
const chars: Character[] = [
  { id: 'ch1', projectId: 'p1', name: 'Gajah Mada', description: 'patih', sheetAssetId: 'a1', sort: 0 }
]
const clip2 = { ...clip, id: 'c2', sort: 1, sceneKey: '02', title: 'Sumpah', motionType: 'video', characterIds: ['ch1'], videoPrompt: 'Angkat kepalan tangan' } as Clip
const { rows, manifest, text, videoText } = buildWorkFolderContent(project, [clip, clip2], chars)
eq('rows count', rows.length, 2)
eq('row1 sceneKey', rows[0].sceneKey, '01')
eq('row1 kind image', rows[0].kind, 'image')
eq('row2 kind video', rows[1].kind, 'video')
eq('row2 videoPrompt custom', rows[1].videoPrompt, 'Angkat kepalan tangan')
eq('row1 prompt is clipPrompt', rows[0].prompt, p)
check('manifest version', manifest.version === 1)
eq('manifest clips', manifest.clips.length, 2)
eq('manifest projectId', manifest.projectId, 'p1')
check('text numbers scenes', text.includes('Adegan 01 — Senja di Majapahit') && text.includes('Adegan 02 — Sumpah'))
// Two separate lists (0.3): the image text never carries a Video: line, and the video
// text carries one Video: per scene (derived for clip 1, custom for clip 2) and no Gambar:.
check('image text has no Video: lines', !text.includes('Video:'))
check('video text has one Video: per scene, no Gambar:', videoText.includes('Video: Angkat kepalan tangan') && videoText.includes('Video: Setting: istana') && !videoText.includes('Gambar:'))
check('video text numbers scenes', videoText.includes('Adegan 01 — Senja di Majapahit') && videoText.includes('Adegan 02 — Sumpah'))
check('text image prompt shared with auto path', text.includes('Gambar: Scene:\nSetting: istana Majapahit saat senja'))

console.log(`\nmanual service test: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
