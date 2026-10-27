import { useState } from 'react'
import { useStore } from '../store'
import type { Cycle, Question, Stage } from '../types'
import { Card, Empty, Link, PageHead, go } from '../ui'
import { STAGE_LABEL, buildReviews } from '../lib/cycle'
import { cx, fmtDate, uid } from '../lib/util'

const STAGES: Stage[] = ['self', 'peer', 'down1', 'down2']

export default function CycleAdmin({ id }: { id?: string }) {
  const { me } = useStore()
  if (me.role !== 'admin') return <Empty>HR 관리자만 볼 수 있어요. 상단에서 박서윤 님으로 바꿔 보세요.</Empty>
  return !id || id === 'new' ? <NewCycle /> : <CycleStatus id={id} />
}

function NewCycle() {
  const { data, update } = useStore()
  const base = data.cycles[0]
  const [name, setName] = useState('2026 하반기 성과 리뷰')
  const [period, setPeriod] = useState('2026-07 ~ 2026-12')
  const [dueDate, setDueDate] = useState('2027-01-20')
  const [stages, setStages] = useState<Stage[]>(['self', 'peer', 'down1'])
  const [questions, setQuestions] = useState<Question[]>(() => structuredClone(base?.questions ?? []))
  const [targets, setTargets] = useState<string[]>(data.users.filter((u) => u.managerId).map((u) => u.id))

  const launch = () => {
    const cycle: Cycle = { id: uid('cy'), name, period, dueDate, stages, questions, targetIds: targets, status: 'writing', finalGrades: {} }
    update((d) => {
      d.cycles.unshift(cycle)
      d.reviews.push(...buildReviews(cycle, d.users))
    })
    go(`reviews/cycle/${cycle.id}`)
  }

  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])

  return (
    <>
      <PageHead kicker="새 리뷰 사이클" title="리뷰를 설계하세요">
        <Link to="reviews" className="btn ghost">
          취소
        </Link>
        <button className="btn primary" onClick={launch} disabled={!name || !stages.length || !targets.length || !questions.length}>
          시작하고 작성 요청 보내기
        </button>
      </PageHead>
      <div className="grid-main">
        <div className="stack">
          <Card title="기본 정보">
            <div className="form">
              <label>
                이름
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <div className="row">
                <label className="grow">
                  평가 기간
                  <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
                </label>
                <label className="grow">
                  작성 마감
                  <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </label>
              </div>
            </div>
          </Card>
          <Card title="리뷰 단계">
            <div className="chips">
              {STAGES.map((s) => (
                <button key={s} className={cx('chip', stages.includes(s) && 'on')} onClick={() => setStages(toggle(stages, s))}>
                  {STAGE_LABEL[s]}
                </button>
              ))}
            </div>
            <p className="muted small">작성자는 조직도에서 자동으로 정해져요. 동료는 같은 리더 아래에서 2명, 1차·2차는 직속·차상위 리더예요.</p>
          </Card>
          <Card
            title="질문"
            action={
              <span className="row">
                <button className="btn small" onClick={() => setQuestions([...questions, { id: uid('q'), type: 'scale', competency: '역량', text: '' }])}>
                  + 척도
                </button>
                <button className="btn small" onClick={() => setQuestions([...questions, { id: uid('q'), type: 'text', text: '' }])}>
                  + 서술
                </button>
              </span>
            }
          >
            <ol className="q-edit">
              {questions.map((q, i) => (
                <li key={q.id} className="row">
                  <span className="tag tag-muted">{q.type === 'scale' ? '척도' : '서술'}</span>
                  {q.type === 'scale' && (
                    <input
                      className="input comp-in"
                      value={q.competency ?? ''}
                      onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, competency: e.target.value } : x)))}
                      aria-label="역량"
                    />
                  )}
                  <input className="input grow" value={q.text} placeholder="질문" onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                  <button className="btn ghost small" onClick={() => setQuestions(questions.filter((_, j) => j !== i))} aria-label="질문 삭제">
                    삭제
                  </button>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <Card title={`대상자 ${targets.length}명`}>
          <ul className="list">
            {data.users.map((u) => (
              <li key={u.id} className="row">
                <input type="checkbox" checked={targets.includes(u.id)} onChange={() => setTargets(toggle(targets, u.id))} aria-label={u.name} />
                <span className="grow">{u.name}</span>
                <span className="muted small">{u.title}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

function CycleStatus({ id }: { id: string }) {
  const { data, update, user } = useStore()
  const [toast, setToast] = useState('')
  const cycle = data.cycles.find((c) => c.id === id)
  if (!cycle) return <Empty>사이클을 찾을 수 없어요.</Empty>
  const rs = data.reviews.filter((r) => r.cycleId === id)
  const pending = rs.filter((r) => r.status !== 'submitted')
  const setStatus = (status: Cycle['status']) => update((d) => (d.cycles.find((c) => c.id === id)!.status = status))

  return (
    <>
      <PageHead kicker={`${cycle.period} · 마감 ${fmtDate(cycle.dueDate)}`} title={cycle.name}>
        <Link to="reviews" className="btn ghost">
          목록
        </Link>
        {cycle.status === 'writing' && (
          <>
            <button
              className="btn"
              disabled={!pending.length}
              onClick={() => {
                setToast(`미제출 작성자 ${new Set(pending.map((p) => p.writerId)).size}명에게 알림을 보냈어요 (데모)`)
                setTimeout(() => setToast(''), 2500)
              }}
            >
              미제출자 알림
            </button>
            <button className="btn primary" onClick={() => setStatus('calibration')}>
              작성 마감 → 캘리브레이션
            </button>
          </>
        )}
        {cycle.status === 'calibration' && (
          <Link to={`calibration/${id}`} className="btn primary">
            캘리브레이션 열기
          </Link>
        )}
      </PageHead>
      {toast && <div className="toast">{toast}</div>}
      <Card title={`작성 현황 ${rs.length - pending.length}/${rs.length}`}>
        <div className="table-wrap">
        <table className="table matrix">
          <thead>
            <tr>
              <th>대상자</th>
              {cycle.stages.map((s) => (
                <th key={s}>{STAGE_LABEL[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cycle.targetIds.map((tid) => (
              <tr key={tid}>
                <td>{user(tid)?.name}</td>
                {cycle.stages.map((s) => {
                  const cell = rs.filter((r) => r.targetId === tid && r.stage === s)
                  return (
                    <td key={s}>
                      {cell.length === 0 && <span className="muted">–</span>}
                      {cell.map((r) => (
                        <span key={r.id} className={cx('cell', `cell-${r.status}`)} title={`${user(r.writerId)?.name} · ${r.status}`}>
                          {user(r.writerId)?.name.slice(-2)}
                        </span>
                      ))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
</div>
        <p className="muted small">
          <span className="cell cell-submitted">제출</span> <span className="cell cell-draft">임시</span> <span className="cell cell-todo">미작성</span>
        </p>
      </Card>
    </>
  )
}
