// AI 보조 기능. 근거 추천·작성 코치·1:1 요약은 서버의 /api/ai(Claude)를 쓰고,
// API 키가 없거나 호출이 실패하면 아래 규칙 기반 구현으로 대신한다.
import type { Data, Question } from '../types'
import type { AiCoachResult, AiEvidencePick, AiSummary, CoachTip, EvidenceCandidate } from './ai-types'

export type { CoachTip }

export interface Evidence extends EvidenceCandidate {
  score: number
  /** Claude가 고른 경우, 이 기록이 질문의 어떤 부분을 뒷받침하는지 */
  reason?: string
}

/** AI 호출 결과. source가 'rules'면 규칙 기반 대체 결과이고 error에 이유가 있다. */
export interface AiResult<T> {
  value: T
  source: 'claude' | 'rules'
  error?: string
}

let status: Promise<boolean> | null = null
/** 서버에 API 키가 설정되어 있는지 (한 번만 확인) */
export function aiAvailable(): Promise<boolean> {
  status ??= fetch('/api/ai/status')
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((j: { enabled?: boolean }) => Boolean(j.enabled))
    .catch(() => false)
  return status
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`/api/ai/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `HTTP ${r.status}`)
  return j as T
}

async function withFallback<T>(call: () => Promise<T>, fallback: () => T): Promise<AiResult<T>> {
  if (!(await aiAvailable())) return { value: fallback(), source: 'rules', error: 'API 키가 없어 규칙 기반으로 보여 줘요' }
  try {
    return { value: await call(), source: 'claude' }
  } catch (e) {
    return { value: fallback(), source: 'rules', error: e instanceof Error ? e.message : String(e) }
  }
}

const COMPETENCY_WORDS: Record<string, string[]> = {
  문제해결: ['원인', '분석', '해결', '가설', '데이터', '인터뷰', '실험', '개선', '근거', '테스트'],
  협업: ['공유', '협업', '함께', '같이', '소통', '리뷰', '도움', '투명'],
  실행력: ['완료', '배포', '달성', '줄였', '늘', '마무리', '끝까지', '일정', '결정'],
  성장: ['배우', '새로운', '시도', '성장', '학습', '도전', '커리어'],
}

const STOP = new Set(['있나요', '했나요', '무엇인가요', '주세요', '적어', '이번', '기간의', '바탕으로', '함께'])

function keywords(q: Question): string[] {
  const own = q.text
    .replace(/[?.,]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/(을|를|이|가|은|는|과|와|의|에|로|으로|하고)$/, ''))
    .filter((w) => w.length >= 2 && !STOP.has(w))
  const comp = q.competency ? COMPETENCY_WORDS[q.competency] ?? [] : Object.values(COMPETENCY_WORDS).flat()
  return [...new Set([...own, ...comp])]
}

function hits(text: string, words: string[]): number {
  return words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0) + (/\d/.test(text) ? 1 : 0)
}

/** 대상자의 목표·체크인·피드백·1:1 기록을 근거 후보로 모은다. */
export function collectCandidates(data: Data, targetId: string): EvidenceCandidate[] {
  const out: EvidenceCandidate[] = []
  for (const o of data.objectives.filter((o) => o.ownerId === targetId)) {
    const krs = o.keyResults.map((k) => `${k.title} ${k.current}/${k.target}${k.unit}`).join(', ')
    out.push({ id: o.id, source: '목표', date: o.checkins.at(-1)?.date ?? '', title: o.title, text: krs })
    for (const c of o.checkins) out.push({ id: c.id, source: '체크인', date: c.date, title: `${o.title} · ${c.progress}%`, text: c.note })
  }
  for (const f of data.feedback.filter((f) => f.toId === targetId)) {
    const from = data.users.find((u) => u.id === f.fromId)?.name ?? ''
    out.push({ id: f.id, source: '피드백', date: f.date, title: `${from} 님의 ${f.kind === 'praise' ? '칭찬' : '조언'}`, text: f.text })
  }
  for (const m of data.meetings.filter((m) => m.memberId === targetId && m.notes)) {
    out.push({ id: m.id, source: '1:1', date: m.date, title: '1:1 미팅 노트', text: m.notes })
  }
  return out
}

/** 규칙 기반: 질문 키워드와 겹치는 기록을 고른다. */
export function findEvidence(data: Data, targetId: string, q: Question, limit = 6): Evidence[] {
  const words = keywords(q)
  return collectCandidates(data, targetId)
    .map((c) => {
      const bonus = c.source === '체크인' || c.source === '피드백' ? 1 : 0
      return { ...c, score: hits(c.source === '목표' ? c.title + c.text : c.text, words) + bonus }
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
    .slice(0, limit)
}

/** Claude가 질문에 맞는 근거를 골라 이유와 함께 돌려준다. */
export function suggestEvidence(data: Data, targetId: string, q: Question): Promise<AiResult<Evidence[]>> {
  const candidates = collectCandidates(data, targetId)
  const targetName = data.users.find((u) => u.id === targetId)?.name ?? ''
  return withFallback(
    async () => {
      const { picks } = await post<{ picks: AiEvidencePick[] }>('evidence', { question: q.text, competency: q.competency, targetName, candidates })
      const byId = new Map(candidates.map((c) => [c.id, c]))
      return picks.flatMap((p, i) => {
        const c = byId.get(p.id)
        return c ? [{ ...c, score: picks.length - i, reason: p.reason }] : []
      })
    },
    () => findEvidence(data, targetId, q),
  )
}

/** 규칙 기반: 리뷰 문장이 구체적이고 사실에 기반하는지 바로 점검한다 (입력 중 실시간 표시용). */
export function coachReview(text: string): { score: number; tips: CoachTip[] } {
  const t = text.trim()
  const tips: CoachTip[] = [
    { ok: t.length >= 80, label: '충분한 분량', hint: '80자 이상으로 상황과 결과를 함께 적어 보세요.' },
    { ok: /\d/.test(t), label: '수치·데이터', hint: '성과를 보여 주는 숫자(%, 건수, 기간)를 넣어 보세요.' },
    {
      ok: /(예를 들어|프로젝트|실험|미팅|배포|\d+월|당시|때)/.test(t),
      label: '구체적 사례',
      hint: '언제, 어떤 일에서 그랬는지 한 가지 사례를 적어 보세요.',
    },
    {
      ok: !/(항상|절대|늘|원래|성격|태도가)/.test(t),
      label: '사실 중심 표현',
      hint: '"항상", "성격" 같은 단정·인성 표현 대신 관찰한 행동을 적어 보세요.',
    },
    {
      ok: !/(별로|못한다|최악|실망)/.test(t),
      label: '건설적인 어조',
      hint: '아쉬운 점은 "~하면 더 좋겠다"처럼 다음 행동으로 바꿔 적어 보세요.',
    },
  ]
  if (!t) return { score: 0, tips }
  return { score: Math.round((tips.filter((x) => x.ok).length / tips.length) * 100), tips }
}

const POS = ['좋', '만족', '감사', '보람', '인정', '대단', '수월', '도움', '즐겁', '성장', '좋아졌']
const NEG = ['힘들', '힘듭', '지치', '걱정', '부족', '많아', '촉박', '불만', '어렵', '스트레스', '불안']

export type Sentiment = 'pos' | 'neg' | 'mix' | 'neu'
export function sentiment(text: string): Sentiment {
  const p = POS.filter((w) => text.includes(w)).length
  const n = NEG.filter((w) => text.includes(w)).length
  if (p && n) return 'mix'
  if (p) return 'pos'
  if (n) return 'neg'
  return 'neu'
}

/** Claude가 답변을 기준별로 검토하고, 원문 사실만 써서 다듬은 예시를 준다. */
export function reviewWithCoach(question: string, answer: string, stage: string): Promise<AiResult<AiCoachResult>> {
  return withFallback(
    () => post<AiCoachResult>('coach', { question, answer, stage }),
    () => ({ ...coachReview(answer), suggestion: '' }),
  )
}

/** 1:1 노트를 Claude로 요약하고 할 일을 뽑는다. */
export function summarizeWithAi(notes: string, leaderName: string, memberName: string, agenda: string[]): Promise<AiResult<AiSummary>> {
  return withFallback(
    () => post<AiSummary>('summarize', { notes, leaderName, memberName, agenda }),
    () => {
      const r = summarizeMeeting(notes)
      return { summary: r.summary, actions: r.actions.map((text) => ({ text, owner: 'member' as const })) }
    },
  )
}

/** 규칙 기반: 1:1 노트에서 요약 문장과 액션 아이템 후보를 뽑는다. */
export function summarizeMeeting(notes: string): { summary: string[]; actions: string[] } {
  const sentences = notes
    .split(/(?<=[.!?다요])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4)
  const actionRe = /(하기로|까지|검토|확인하|작성|준비|요청|이어서)/
  const actions = sentences.filter((s) => actionRe.test(s)).map((s) => s.replace(/\.$/, ''))
  const summary = sentences.filter((s) => !actionRe.test(s)).slice(0, 3)
  return { summary: summary.length ? summary : sentences.slice(0, 2), actions }
}
