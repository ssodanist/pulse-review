// 배포용 서버: 빌드된 화면(dist)과 /api/ai를 함께 내보낸다.
// 실행: npm run build && npm start  (Node 24 이상, .ts를 그대로 실행)
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { handle } from './plugin.ts'

const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const PORT = Number(process.env.PORT) || 8080
const PASSWORD = process.env.APP_PASSWORD ?? ''
// AI 호출 한도: 접속자(IP)당 시간당, 서버 전체 하루당
const PER_IP_HOURLY = Number(process.env.AI_LIMIT_PER_HOUR) || 30
const DAILY = Number(process.env.AI_LIMIT_PER_DAY) || 300

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
}

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** 브라우저 기본 로그인 창(Basic 인증)으로 비밀번호를 확인한다. 아이디는 아무거나 받는다. */
function authorized(req: IncomingMessage): boolean {
  const header = req.headers.authorization ?? ''
  if (!header.startsWith('Basic ')) return false
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  return sameText(decoded.slice(decoded.indexOf(':') + 1), PASSWORD)
}

const hits = new Map<string, number[]>()
let day = ''
let dayCount = 0

/** 한도 안이면 null, 넘었으면 안내 문구를 돌려준다. */
function overLimit(ip: string): string | null {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== day) {
    day = today
    dayCount = 0
  }
  if (dayCount >= DAILY) return '오늘 AI 사용 한도를 다 썼어요. 내일 다시 시도하세요'
  const hourAgo = Date.now() - 3_600_000
  const recent = (hits.get(ip) ?? []).filter((t) => t > hourAgo)
  if (recent.length >= PER_IP_HOURLY) return '한 시간 AI 사용 한도를 넘었어요. 잠시 후 다시 시도하세요'
  recent.push(Date.now())
  hits.set(ip, recent)
  dayCount++
  return null
}

async function serveStatic(path: string, res: ServerResponse) {
  const file = normalize(join(DIST, decodeURIComponent(path)))
  // dist 밖의 파일은 내보내지 않는다
  const target = file.startsWith(DIST) && !file.endsWith(sep) ? file : join(DIST, 'index.html')
  try {
    const body = await readFile(target)
    res.setHeader('content-type', TYPES[extname(target)] ?? 'application/octet-stream')
    if (target.includes(`${sep}assets${sep}`)) res.setHeader('cache-control', 'public, max-age=31536000, immutable')
    res.end(body)
  } catch {
    // 해시 라우팅이라 없는 경로는 첫 화면으로 보낸다
    res.setHeader('content-type', TYPES['.html'])
    res.end(await readFile(join(DIST, 'index.html')))
  }
}

const server = createServer(async (req, res) => {
  if (!PASSWORD) {
    res.statusCode = 503
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    return res.end('APP_PASSWORD 환경 변수를 설정해야 열립니다.')
  }
  if (!authorized(req)) {
    res.statusCode = 401
    res.setHeader('www-authenticate', 'Basic realm="Pulse", charset="UTF-8"')
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    return res.end('비밀번호가 필요해요.')
  }
  const path = (req.url ?? '/').split('?')[0]
  if (path.startsWith('/api/ai/')) {
    if (req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()
      const limit = overLimit(ip)
      if (limit) {
        res.statusCode = 429
        res.setHeader('content-type', 'application/json; charset=utf-8')
        return res.end(JSON.stringify({ error: limit }))
      }
    }
    req.url = path.slice('/api/ai'.length)
    return handle(req, res)
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    return res.end()
  }
  return serveStatic(path === '/' ? 'index.html' : path, res)
})

server.listen(PORT, () => console.log(`Pulse 서버 실행 중: http://localhost:${PORT}`))
