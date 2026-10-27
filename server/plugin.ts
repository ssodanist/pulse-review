// Vite 개발/미리보기 서버에 /api/ai 엔드포인트를 붙인다.
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import Anthropic from '@anthropic-ai/sdk'
import { aiEnabled, coach, keyProblem, pickEvidence, summarize } from './claude.ts'

const MAX_BODY = 200_000

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export async function handle(req: IncomingMessage, res: ServerResponse) {
  const path = (req.url ?? '').split('?')[0]
  if (path === '/status') return send(res, 200, { enabled: aiEnabled(), problem: keyProblem() })
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' })
  if (!aiEnabled()) return send(res, 503, { error: 'ANTHROPIC_API_KEY가 설정되지 않았어요' })
  const problem = keyProblem()
  if (problem) return send(res, 503, { error: problem })
  try {
    const body = await readJson(req)
    if (path === '/evidence') return send(res, 200, { picks: await pickEvidence(body) })
    if (path === '/coach') return send(res, 200, await coach(body))
    if (path === '/summarize') return send(res, 200, await summarize(body))
    return send(res, 404, { error: 'not found' })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return send(res, 401, { error: 'API 키가 올바르지 않아요' })
    if (err instanceof Anthropic.RateLimitError) return send(res, 429, { error: '요청이 많아요. 잠시 후 다시 시도하세요' })
    if (err instanceof Anthropic.APIError) {
      console.error('[ai]', err.status, err.message)
      // 잔액 부족은 전용 오류 클래스가 없어 메시지로 구분한다
      if (err.status === 400 && /credit balance/i.test(err.message))
        return send(res, 402, { error: 'Anthropic 계정 크레딧이 부족해요. console.anthropic.com → Billing에서 충전하세요' })
      return send(res, 502, { error: `Claude API 오류 (${err.status})` })
    }
    console.error('[ai]', err)
    return send(res, 500, { error: 'AI 응답을 처리하지 못했어요' })
  }
}

export function aiApi(): Plugin {
  // 값을 돌려주면 Vite가 후처리 훅으로 실행하므로 아무것도 반환하지 않는다
  const mount = (server: { middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse) => void) => unknown } }): void => {
    server.middlewares.use('/api/ai', (req, res) => void handle(req, res))
  }
  return {
    name: 'pulse-ai-api',
    configureServer: mount,
    configurePreviewServer: mount,
  }
}
