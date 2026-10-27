import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import type { Data, Question, Review } from '../types'
import { Card, Empty, Link, PageHead, Person, Scale, go } from '../ui'
import { coachReview, reviewWithCoach, suggestEvidence, type AiResult, type Evidence } from '../lib/ai'
import type { AiCoachResult } from '../lib/ai-types'
import { STAGE_LABEL } from '../lib/cycle'
import { cx, fmtDate } from '../lib/util'

export default function ReviewWrite({ id }: { id: string }) {
  const { data, me, update, user } = useStore()
  const review = data.reviews.find((r) => r.id === id)
  const cycle = data.cycles.find((c) => c.id === review?.cycleId)
  const [focus, setFocus] = useState<string>(cycle?.questions[0]?.id ?? '')
  const [answers, setAnswers] = useState<Review['answers']>(() => structuredClone(review?.answers ?? {}))
  const [saved, setSaved] = useState('')

  // 동료는 공개된 기록만, 리더와 본인은 1:1·비공개 피드백까지 근거로 본다
  const scoped = useMemo<Data>(() => {
    if (!review || review.stage !== 'peer') return data
    return { ...data, meetings: [], feedback: data.feedback.filter((f) => f.visibility === 'public') }
  }, [data, review])

  if (!review || !cycle) return <Empty>리뷰를 찾을 수 없어요.</Empty>
  if (review.writerId !== me.id) return <Empty>이 리뷰는 {user(review.writerId)?.name} 님이 작성하는 리뷰예요. 상단에서 사용자를 바꿔 보세요.</Empty>

  const target = user(review.targetId)!
  const locked = review.status === 'submitted'
  const editable = !locked && cycle.status === 'writing'
  const q = cycle.questions.find((x) => x.id === focus) ?? cycle.questions[0]
  const missing = cycle.questions.filter((x) => (x.type === 'scale' ? !answers[x.id]?.score : !answers[x.id]?.text?.trim()))
  const selfReview = review.stage !== 'self' && review.stage !== 'peer' ? data.reviews.find((r) => r.cycleId === cycle.id && r.targetId === target.id && r.stage === 'self' && r.status === 'submitted') : undefined

  const set = (qid: string, patch: Partial<Review['answers'][string]>) => setAnswers((a) => ({ ...a, [qid]: { ...a[qid], ...patch } }))
  const persist = (status: Review['status']) => {
    update((d) => {
      const r = d.reviews.find((x) => x.id === id)!
      r.answers = answers
      r.status = status
    })
    setSaved(status === 'submitted' ? '제출했어요' : '임시 저장했어요')
    if (status === 'submitted') setTimeout(() => go('reviews'), 600)
  }

  return (
    <>
      <PageHead kicker={`${cycle.name} · ${STAGE_LABEL[review.stage]}`} title={review.stage === 'self' ? '나를 돌아보는 셀프 리뷰' : <>{target.name} 님에 대한 리뷰</>}>
        <Link to="reviews" className="btn ghost">
          목록
        </Link>
        {editable && (
          <>
            <button className="btn" onClick={() => persist('draft')}>
              임시 저장
            </button>
            <button className="btn primary" disabled={missing.length > 0} title={missing.length ? `${missing.length}개 질문이 남았어요` : ''} onClick={() => persist('submitted')}>
              제출
            </button>
          </>
        )}
        {locked && cycle.status === 'writing' && (
          <button className="btn" onClick={() => persist('draft')}>
            제출 취소하고 수정
          </button>
        )}
      </PageHead>
      {saved && <div className="toast">{saved}</div>}
      <div className="grid-main">
        <div className="stack">
          <Card>
            <Person user={target} sub={`${target.title} · ${data.teams.find((t) => t.id === target.teamId)?.name}`} />
            <p className="muted small">
              {review.stage === 'peer' ? '동료 리뷰는 대상자에게 작성자 이름 없이 전달돼요.' : review.stage === 'self' ? '셀프 리뷰는 리더와 HR이 함께 봐요.' : '리더 리뷰는 캘리브레이션에서 등급 조율의 근거가 돼요.'}
              {' '}
              {missing.length ? `남은 질문 ${missing.length}개` : '모든 질문에 답했어요.'}
            </p>
          </Card>
          {cycle.questions.map((qq, i) => (
            <section key={qq.id} className={cx('card', 'q-card', focus === qq.id && 'focus')} onFocusCapture={() => setFocus(qq.id)} onClick={() => setFocus(qq.id)}>
              <div className="q-head">
                <span className="q-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="grow">
                  {qq.competency && <span className="tag tag-muted">{qq.competency}</span>}
                  <h3>{qq.text}</h3>
                </span>
              </div>
              {qq.type === 'scale' ? (
                <Scale value={answers[qq.id]?.score} onChange={(v) => set(qq.id, { score: v })} disabled={!editable} />
              ) : (
                <textarea
                  className="input"
                  rows={6}
                  disabled={!editable}
                  value={answers[qq.id]?.text ?? ''}
                  onChange={(e) => set(qq.id, { text: e.target.value })}
                  placeholder="오른쪽 근거 패널의 기록을 참고해 구체적으로 적어 보세요."
                />
              )}
              {selfReview && (
                <div className="self-ref">
                  <span className="muted small">본인 답변</span>
                  {qq.type === 'scale' ? <b> {selfReview.answers[qq.id]?.score ?? '–'}점</b> : <p className="small">{selfReview.answers[qq.id]?.text || '–'}</p>}
                </div>
              )}
            </section>
          ))}
        </div>
        <aside className="stack sticky">
          {q && <EvidencePanel data={scoped} targetId={target.id} q={q} onCite={editable ? (t) => {
            const text = cycle.questions.find((x) => x.type === 'text' && x.id === focus) ? focus : cycle.questions.find((x) => x.type === 'text')?.id
            if (!text) return
            setFocus(text)
            set(text, { text: ((answers[text]?.text ?? '') + (answers[text]?.text ? '\n' : '') + t).trim() })
          } : undefined} />}
          {q?.type === 'text' && <Coach key={q.id} question={q.text} stage={STAGE_LABEL[review.stage]} text={answers[q.id]?.text ?? ''} editable={editable} />}
        </aside>
      </div>
    </>
  )
}

// 질문별 근거 추천 결과를 화면 이동 사이에도 다시 부르지 않도록 보관한다
const evidenceCache = new Map<string, AiResult<Evidence[]>>()

function EvidencePanel({ data, targetId, q, onCite }: { data: Data; targetId: string; q: Question; onCite?: (t: string) => void }) {
  const key = `${targetId}:${q.id}`
  const [result, setResult] = useState<AiResult<Evidence[]> | null>(() => evidenceCache.get(key) ?? null)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    const cached = evidenceCache.get(key)
    setResult(cached ?? null)
    if (cached) return
    let alive = true
    suggestEvidence(dataRef.current, targetId, q).then((r) => {
      evidenceCache.set(key, r)
      if (alive) setResult(r)
    })
    return () => {
      alive = false
    }
  }, [key, targetId, q])

  const refresh = () => {
    evidenceCache.delete(key)
    setResult(null)
    suggestEvidence(dataRef.current, targetId, q).then((r) => {
      evidenceCache.set(key, r)
      setResult(r)
    })
  }

  const ev = result?.value ?? []
  return (
    <Card
      title={<>✦ 이 질문의 근거 {result && <span className="muted">({ev.length})</span>}</>}
      action={result && <button className="btn ghost small" onClick={refresh}>다시 찾기</button>}
    >
      <AiSource result={result} what="목표, 체크인, 피드백, 1:1 기록에서 이 질문과 관련 있는 것을 골랐어요." />
      {!result && <div className="ai-loading">Claude가 기록을 읽고 있어요…</div>}
      {result && ev.length === 0 && <Empty>관련 기록이 없어요.</Empty>}
      <ul className="evidence">
        {ev.map((e) => (
          <li key={e.id}>
            <div className="row">
              <span className={cx('src', `src-${e.source}`)}>{e.source}</span>
              <span className="grow small ellipsis">{e.title}</span>
              {e.date && <span className="muted small">{fmtDate(e.date)}</span>}
            </div>
            {e.reason && <p className="small ev-reason">✦ {e.reason}</p>}
            <p className="small">{e.text}</p>
            {onCite && (
              <button className="btn ghost small" onClick={() => onCite(`(${e.source} ${e.date ? fmtDate(e.date) : ''}) ${e.text}`)}>
                답변에 인용
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function AiSource({ result, what }: { result: AiResult<unknown> | null; what: string }) {
  if (!result) return <p className="muted small">{what}</p>
  return (
    <p className="muted small">
      <span className={cx('ai-badge', result.source === 'claude' ? 'on' : 'off')}>{result.source === 'claude' ? 'Claude' : '규칙 기반'}</span> {what}
      {result.error && <span className="ai-err"> ({result.error})</span>}
    </p>
  )
}

function Coach({ question, stage, text, editable }: { question: string; stage: string; text: string; editable: boolean }) {
  const live = coachReview(text)
  const [ai, setAi] = useState<{ for: string; result: AiResult<AiCoachResult> } | null>(null)
  const [loading, setLoading] = useState(false)
  const stale = ai && ai.for !== text
  const shown = ai && !stale ? ai.result.value : live

  const run = async () => {
    setLoading(true)
    const result = await reviewWithCoach(question, text, stage)
    setAi({ for: text, result })
    setLoading(false)
  }

  return (
    <Card title="✦ 작성 코치" action={<span className={cx('coach-score', shown.score >= 80 ? 'good' : shown.score >= 40 ? 'mid' : 'low')}>{shown.score}</span>}>
      {ai && !stale ? (
        <AiSource result={ai.result} what="답변을 기준별로 검토했어요." />
      ) : (
        <p className="muted small">입력하는 동안은 기본 점검을 보여 줘요. 더 깊은 검토는 Claude에게 맡기세요.</p>
      )}
      <ul className="coach">
        {shown.tips.map((t) => (
          <li key={t.label} className={t.ok ? 'ok' : ''}>
            <b>{t.ok ? '✓' : '·'} {t.label}</b>
            {!t.ok && t.hint && <span className="muted small">{t.hint}</span>}
          </li>
        ))}
      </ul>
      {ai && !stale && ai.result.value.suggestion && (
        <div className="ai-box small">
          <div className="ai-label">다듬은 예시 (원문 사실만 사용, [ ]는 채워 넣을 부분)</div>
          <p>{ai.result.value.suggestion}</p>
        </div>
      )}
      {editable && (
        <button className="btn small coach-run" disabled={loading || text.trim().length < 10} onClick={run}>
          {loading ? 'Claude가 읽는 중…' : stale ? '✦ 바뀐 답변 다시 검토받기' : '✦ Claude에게 검토받기'}
        </button>
      )}
    </Card>
  )
}
