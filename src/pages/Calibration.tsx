import { useState } from 'react'
import { reportsOf, useStore } from '../store'
import type { Grade } from '../types'
import { Avatar, Card, Empty, GradeChip, Link, PageHead, Tabs } from '../ui'
import { GRADES, GUIDE, STAGE_LABEL, otherScore, selfScore, suggestGrade } from '../lib/cycle'
import { cx } from '../lib/util'

export default function Calibration({ cycleId }: { cycleId?: string }) {
  const { data, me, update, user } = useStore()
  const candidates = data.cycles.filter((c) => c.status !== 'draft')
  const cycle = candidates.find((c) => c.id === cycleId) ?? candidates.find((c) => c.status === 'calibration') ?? candidates[0]
  const [selected, setSelected] = useState<string | null>(null)

  if (me.role === 'member') return <Empty>리더와 HR만 볼 수 있어요.</Empty>
  if (!cycle) return <Empty>조율할 사이클이 없어요.</Empty>

  const scope = me.role === 'admin' ? cycle.targetIds : reportsOf(data, me.id).map((u) => u.id).filter((id) => cycle.targetIds.includes(id))
  const editable = cycle.status === 'calibration' && me.role === 'admin'
  const prev = data.cycles.find((c) => c.status === 'closed' && c.id !== cycle.id)

  const rows = scope.map((id) => {
    const other = otherScore(data, cycle.id, id)
    const self = selfScore(data, cycle.id, id)
    const final = cycle.finalGrades[id] ?? suggestGrade(other)
    return { id, other, self, gap: other != null && self != null ? self - other : null, final, suggested: suggestGrade(other) }
  })
  const dist = Object.fromEntries(GRADES.map((g) => [g, rows.filter((r) => r.final === g).length])) as Record<Grade, number>

  const setGrade = (id: string, g: Grade) => update((d) => (d.cycles.find((c) => c.id === cycle.id)!.finalGrades[id] = g))
  const confirmAll = () =>
    update((d) => {
      const c = d.cycles.find((x) => x.id === cycle.id)!
      rows.forEach((r) => r.final && (c.finalGrades[r.id] = r.final))
      c.status = 'closed'
    })

  const sel = rows.find((r) => r.id === selected)

  return (
    <>
      <PageHead kicker="캘리브레이션" title={cycle.name}>
        {candidates.length > 1 && (
          <Tabs value={cycle.id} onChange={(v) => (location.hash = `/calibration/${v}`)} options={candidates.map((c) => [c.id, c.name] as [string, string])} />
        )}
        {cycle.status === 'writing' && me.role === 'admin' && (
          <Link to={`reviews/cycle/${cycle.id}`} className="btn">
            작성 마감하러 가기
          </Link>
        )}
        {editable && (
          <button className="btn primary" onClick={() => {
              const missing = rows.filter((r) => !r.final).length
              const msg = missing ? `등급이 없는 대상자 ${missing}명은 미확정으로 남아요. 그래도 확정하고 사이클을 종료할까요?` : '등급을 확정하고 사이클을 종료할까요?'
              if (confirm(msg)) confirmAll()
            }}>
            등급 확정
          </button>
        )}
      </PageHead>
      {cycle.status === 'writing' && <p className="notice">아직 작성 중이에요. 지금 보이는 등급은 제출된 리뷰 기준 제안 등급이에요.</p>}
      {cycle.status === 'closed' && <p className="notice">확정된 사이클이에요. 등급은 읽기 전용이에요.</p>}

      <Card title="등급 분포">
        <div className="dist">
          {GRADES.map((g) => {
            const n = dist[g]
            const guide = Math.round(GUIDE[g] * rows.length)
            const max = Math.max(rows.length * 0.6, 1)
            return (
              <div key={g} className="dist-col">
                <div className="dist-bars">
                  <span className="bar-guide" style={{ height: `${(guide / max) * 100}%` }} title={`권장 ${guide}명`} />
                  <span className={cx('bar', `bar-${g}`, n > guide + 1 && 'over')} style={{ height: `${(n / max) * 100}%` }} />
                </div>
                <GradeChip grade={g} />
                <span className="small">
                  {n}명 <span className="muted">/ 권장 {guide}</span>
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="board">
        {GRADES.map((g) => (
          <div key={g} className={cx('board-col', `col-${g}`)}>
            <header>
              <GradeChip grade={g} /> <span className="muted small">{dist[g]}명</span>
            </header>
            {rows
              .filter((r) => r.final === g)
              .sort((a, b) => (b.other ?? 0) - (a.other ?? 0))
              .map((r) => {
                const u = user(r.id)!
                const i = GRADES.indexOf(g)
                return (
                  <div key={r.id} className={cx('pcard', selected === r.id && 'on')} onClick={() => setSelected(r.id)}>
                    <div className="row">
                      <Avatar user={u} size={26} />
                      <span className="grow">
                        <b>{u.name}</b>
                        <span className="muted small">{u.title}</span>
                      </span>
                      <span className="num">{r.other?.toFixed(2) ?? '–'}</span>
                    </div>
                    <div className="row small">
                      {r.suggested && r.suggested !== g && <span className="tag tag-muted">제안 {r.suggested}</span>}
                      {r.gap != null && Math.abs(r.gap) >= 0.7 && <span className={cx('tag', r.gap > 0 ? 'tag-risk' : 'tag-on')}>{r.gap > 0 ? '↗ 자기 과대평가' : '↘ 자기 과소평가'}</span>}
                      {prev?.finalGrades[r.id] && <span className="muted">직전 {prev.finalGrades[r.id]}</span>}
                    </div>
                    {editable && (
                      <div className="row move">
                        <button className="btn ghost small" disabled={i === 0} onClick={(e) => (e.stopPropagation(), setGrade(r.id, GRADES[i - 1]))} aria-label="등급 올리기">
                          ← 올리기
                        </button>
                        <button className="btn ghost small" disabled={i === GRADES.length - 1} onClick={(e) => (e.stopPropagation(), setGrade(r.id, GRADES[i + 1]))} aria-label="등급 내리기">
                          내리기 →
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        ))}
        {rows.some((r) => !r.final) && (
          <div className="board-col">
            <header className="muted small">리뷰 부족</header>
            {rows
              .filter((r) => !r.final)
              .map((r) => (
                <div key={r.id} className="pcard dim">
                  {user(r.id)?.name}
                  {editable && (
                    <div className="row">
                      {GRADES.map((g) => (
                        <button key={g} className="btn ghost small" onClick={() => setGrade(r.id, g)}>
                          {g}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {sel && <Detail cycleId={cycle.id} row={sel} onClose={() => setSelected(null)} />}
    </>
  )
}

function Detail({ cycleId, row, onClose }: { cycleId: string; row: { id: string; other: number | null; self: number | null }; onClose: () => void }) {
  const { data, user } = useStore()
  const u = user(row.id)!
  const cycle = data.cycles.find((c) => c.id === cycleId)!
  const rs = data.reviews.filter((r) => r.cycleId === cycleId && r.targetId === row.id && r.status === 'submitted')
  const goals = data.objectives.filter((o) => o.ownerId === row.id)
  return (
    <Card title={<>{u.name} · 조율 근거</>} action={<button className="btn ghost small" onClick={onClose}>닫기</button>} className="detail">
      <div className="stat-row">
        <div className="stat">
          <div className="stat-v">{row.other?.toFixed(2) ?? '–'}</div>
          <div className="stat-l">동료·리더 평균</div>
        </div>
        <div className="stat">
          <div className="stat-v">{row.self?.toFixed(2) ?? '–'}</div>
          <div className="stat-l">자기 평가</div>
        </div>
        <div className="stat">
          <div className="stat-v">{u.salary.toLocaleString()}</div>
          <div className="stat-l">현재 연봉 (만원)</div>
        </div>
        <div className="stat">
          <div className="stat-v">{goals.filter((g) => g.status === 'done').length}/{goals.length}</div>
          <div className="stat-l">목표 완료</div>
        </div>
      </div>
      <div className="grid-2">
        {rs
          .filter((r) => r.stage !== 'peer')
          .map((r) => (
            <div key={r.id}>
              <h4>
                {STAGE_LABEL[r.stage]} · {user(r.writerId)?.name}
              </h4>
              {cycle.questions
                .filter((q) => q.type === 'text')
                .map((q) => (
                  <p key={q.id} className="small">
                    <span className="muted">{q.text}</span>
                    <br />
                    {r.answers[q.id]?.text || '–'}
                  </p>
                ))}
            </div>
          ))}
      </div>
      <Link to={`people/${u.id}`} className="btn small">
        인사카드 열기
      </Link>
    </Card>
  )
}
