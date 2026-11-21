// Mock LLM untuk uji harness naskah per bagian (BUKAN bagian aplikasi).
// Server OpenAI-compatible kecil di localhost: menjawab /v1/chat/completions dengan adegan
// deterministik (narasi 12 kata, diakhiri titik), jadi generate naskah 20-30 menit bisa diuji
// tanpa memanggil Gemini asli dan tanpa biaya. Dijalankan:
//   node bukti-naskah-per-bagian/mock-llm.cjs [port]
// Kendali lewat HTTP:
//   POST /__control { "failNext": N, "failStatus": 500 }  -> N permintaan chat berikutnya gagal
//   POST /__control { "failOn": [3,4,5], "failStatus": 500 } -> permintaan chat ke-3, 4, 5 gagal
//   POST /__control { "reset": true }                    -> nol-kan penghitung
//   GET  /__stats  -> { requests, failed, ranges: ["1-30", "31-60", ...] }
const http = require('node:http')

const PORT = Number(process.argv[2] || 18777)
let requests = 0
let failed = 0
let failNext = 0
let failOn = []
let failStatus = 500
const ranges = []

function scenesFor(from, to) {
  const out = []
  for (let n = from; n <= to; n++) {
    out.push({
      title: `Adegan ${n}`,
      story: `Alur adegan ${n} dari cerita uji.`,
      // 12 spoken words, ends with a period: valid by the doubtful-scene rule.
      narration: `Adegan nomor ${n} bercerita tentang satu peristiwa penting yang mengubah jalannya cerita.`
    })
  }
  return out
}

const server = http.createServer((req, res) => {
  // The harness page (localhost:5173) calls this server cross-origin; answer
  // preflights or the browser blocks every POST before it reaches us.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/__control' && req.method === 'POST') {
      const ctl = JSON.parse(body || '{}')
      if (ctl.reset) {
        requests = 0
        failed = 0
        failNext = 0
        failOn = []
        ranges.length = 0
      }
      if (typeof ctl.failNext === 'number') failNext = ctl.failNext
      if (Array.isArray(ctl.failOn)) failOn = ctl.failOn
      if (typeof ctl.failStatus === 'number') failStatus = ctl.failStatus
      res.end(JSON.stringify({ ok: true, failNext }))
      return
    }
    if (req.url === '/__stats' && req.method === 'GET') {
      res.end(JSON.stringify({ requests, failed, ranges }))
      return
    }
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      requests++
      if (failNext > 0 || failOn.includes(requests)) {
        if (failNext > 0) failNext--
        failed++
        res.statusCode = failStatus
        res.end(JSON.stringify({ error: { message: 'mock failure (simulasi gagal)' } }))
        return
      }
      let from = 1
      let to = 5
      try {
        const parsed = JSON.parse(body || '{}')
        const text = (parsed.messages || []).map((m) => String(m.content || '')).join('\n')
        const m = text.match(/scenes (\d+) to (\d+)/)
        if (m) {
          from = Number(m[1])
          to = Number(m[2])
        } else {
          const e = text.match(/exactly (\d+) scenes/)
          if (e) to = Number(e[1])
        }
      } catch {
        // Fall back to the default range above.
      }
      ranges.push(`${from}-${to}`)
      const content = JSON.stringify({ title: 'Cerita Uji Mock', scenes: scenesFor(from, to) })
      res.end(
        JSON.stringify({
          id: 'mock-1',
          object: 'chat.completion',
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }]
        })
      )
      return
    }
    res.statusCode = 404
    res.end(JSON.stringify({ error: { message: 'tidak dikenal' } }))
  })
})

server.listen(PORT, '127.0.0.1', () => console.log(`[mock-llm] mendengarkan di http://127.0.0.1:${PORT}`))
