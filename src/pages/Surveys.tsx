import { useState } from 'react'
import { useStore } from '../store'
import type { Survey } from '../types'
import { Card, Empty, Link, PageHead, Scale } from '../ui'
import { sentiment, type Sentiment } from '../lib/ai'
import { avg, cx, fmtDate, today, uid } from '../lib/util'
import { Stat } from './Goals'

const MIN_RESPONSES = 3
const SENT_LABEL: Record<Sentiment, string> = { pos: '긍정', neu: '중립', mix: '혼재', neg: '부정' }

export default function Surveys({ id }: { id?: string }) {
  const { data, me, update } = useStore()
  if (id) return <SurveyDetail id={id} />

  const create = () => {
    const base = data.surveys[0]
    const nid = uid('s')
    update((d) =>
      d.surveys.unshift({
        id: nid,
        title: `${new Date().getMonth() + 1}월 팀 컨디션 서베이`,
        status: 'open',
        createdAt: today(),
        questions: structuredClone(base.questions).map((q) => ({ ...q, id: uid('sq') })),
        responses: [],
      }),
    )
    location.hash = `/surveys/${nid}`
  }

  return (
    <>
      <PageHead kicker="서베이 · 몰입" title="문제가 커지기 전에 신호를 보세요">
        {me.role === 'admin' && (
          <button className="btn primary" onClick={create}>
            새 서베이 (지난 문항 복사)
          </button>
        )}
      </PageHead>
      <div className="stack">
        {data.surveys.map((s) => {
          const answered = s.responses.some((r) => r.userId === me.id)
          return (
            <Card key={s.id}>
              <div className="row">
                <span className="grow">
                  <Link to={`surveys/${s.id}`}>
                    <b>{s.title}</b>
                  </Link>
                  <span className="muted small">
                    {fmtDate(s.createdAt)} · 응답 {s.responses.length}/{data.users.length}명 · {s.status === 'open' ? '진행 중' : '종료'}
                  </span>
                </span>
                {s.status === 'open' && !answered ? (
                  <Link to={`surveys/${s.id}`} className="btn primary small">
                    응답하기
                  </Link>
                ) : (
                  <Link to={`surveys/${s.id}`} className="btn small">
                    {me.role === 'member' ? '응답 완료' : '결과 보기'}
                  </Link>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}

function SurveyDetail({ id }: { id: string }) {
  const { data, me, update } = useStore()
  const s = data.surveys.find((x) => x.id === id)
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  if (!s) return <Empty>서베이를 찾을 수 없어요.</Empty>
  const answered = s.responses.some((r) => r.userId === me.id)
  const canAnswer = s.status === 'open' && !answered
  const canSeeResults = me.role !== 'member'
  const ready = s.questions.every((q) => q.type === 'text' || typeof answers[q.id] === 'number')

  return (
    <>
      <PageHead kicker="서베이" title={s.title}>
        <Link to="surveys" className="btn ghost">
          목록
        </Link>
        {me.role === 'admin' && s.status === 'open' && (
          <button className="btn" onClick={() => update((d) => (d.surveys.find((x) => x.id === id)!.status = 'closed'))}>
            서베이 종료
          </button>
        )}
      </PageHead>
      {canAnswer && (
        <div className="stack">
          <p className="notice">응답은 익명으로 집계되고, {MIN_RESPONSES}명 이상 응답했을 때만 결과가 보여요.</p>
          {s.questions.map((q, i) => (
            <Card key={q.id}>
              <div className="q-head">
                <span className="q-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="grow">
                  <span className="tag tag-muted">{q.category}</span>
                  <h3>{q.text}</h3>
                </span>
              </div>
              {q.type === 'scale' ? (
                <Scale value={answers[q.id] as number | undefined} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
              ) : (
                <textarea className="input" rows={3} value={(answers[q.id] as string) ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              )}
            </Card>
          ))}
          <button className="btn primary" disabled={!ready} onClick={() => update((d) => d.surveys.find((x) => x.id === id)!.responses.push({ userId: me.id, answers }))}>
            제출
          </button>
        </div>
      )}
      {!canAnswer && !canSeeResults && <Empty>응답해 주셔서 고마워요. 결과는 HR과 리더가 정리해 공유할 예정이에요.</Empty>}
      {canSeeResults && !canAnswer && <Results s={s} total={data.users.length} />}
      {canSeeResults && canAnswer && <p className="muted small">결과는 응답 후 볼 수 있어요.</p>}
    </>
  )
}

function Results({ s, total }: { s: Survey; total: number }) {
  const n = s.responses.length
  if (n < MIN_RESPONSES) return <Empty>응답이 {MIN_RESPONSES}명 이상 모이면 결과가 보여요. (현재 {n}명)</Empty>
  const scaleQs = s.questions.filter((q) => q.type === 'scale')
  const cats = [...new Set(scaleQs.map((q) => q.category))]
  const qAvg = (qid: string) => avg(s.responses.map((r) => r.answers[qid]).filter((x): x is number => typeof x === 'number')) ?? 0
  const catAvg = cats.map((c) => [c, avg(scaleQs.filter((q) => q.category === c).map((q) => qAvg(q.id))) ?? 0] as const)
  const overall = avg(catAvg.map(([, v]) => v)) ?? 0
  const comments = s.questions
    .filter((q) => q.type === 'text')
    .flatMap((q) => s.responses.map((r) => r.answers[q.id]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0))
  const sents = comments.map((c) => [c, sentiment(c)] as const)
  const sentCount = (['pos', 'neu', 'mix', 'neg'] as Sentiment[]).map((k) => [k, sents.filter(([, v]) => v === k).length] as const)
  const weakest = [...catAvg].sort((a, b) => a[1] - b[1])[0]

  return (
    <div className="stack">
      <div className="stat-row">
        <Stat label="응답률" value={`${Math.round((n / total) * 100)}%`} sub={`${n}/${total}명`} />
        <Stat label="종합 점수" value={overall.toFixed(2)} sub="5점 만점" />
        <Stat label="가장 낮은 영역" value={weakest[0]} tone={weakest[1] < 3 ? 'warn' : undefined} sub={weakest[1].toFixed(2)} />
      </div>
      <div className="grid-2">
        <Card title="영역별 결과">
          <ul className="hbars">
            {catAvg.map(([c, v]) => (
              <li key={c}>
                <span className="hb-l">{c}</span>
                <span className="hb-t">
                  <span className={cx('hb-f', v < 3 && 'low')} style={{ width: `${(v / 5) * 100}%` }} />
                </span>
                <span className="num">{v.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <h4>문항별</h4>
          <ul className="list">
            {scaleQs.map((q) => (
              <li key={q.id} className="row small">
                <span className="grow">{q.text}</span>
                <b className="num">{qAvg(q.id).toFixed(2)}</b>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="✦ 주관식 감정 분포">
          <div className="sent-bar">
            {sentCount.map(([k, c]) => (c ? <span key={k} className={`sent-${k}`} style={{ flex: c }} title={`${SENT_LABEL[k]} ${c}`} /> : null))}
          </div>
          <div className="row small legend">
            {sentCount.map(([k, c]) => (
              <span key={k}>
                <i className={`sw sent-${k}`} /> {SENT_LABEL[k]} {c}
              </span>
            ))}
          </div>
          <ul className="comments">
            {sents.map(([c, k], i) => (
              <li key={i} className={`c-${k}`}>
                {c}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
