import { useStore } from '../store'
import { Card, Empty, GradeChip, Link, PageHead, Person, Progress } from '../ui'
import { STAGE_LABEL, otherScore } from '../lib/cycle'
import { cx, daysFrom, fmtDate } from '../lib/util'
import type { Cycle } from '../types'

const CYCLE_STATUS: Record<Cycle['status'], string> = { draft: '준비 중', writing: '작성 중', calibration: '조율 중', closed: '종료' }

export default function Reviews() {
  const { data, me } = useStore()
  const active = data.cycles.filter((c) => c.status === 'writing')
  const closed = data.cycles.filter((c) => c.status === 'closed' && c.targetIds.includes(me.id))

  return (
    <>
      <PageHead kicker="성과 리뷰" title="기억이 아니라 기록으로 쓰는 리뷰">
        {me.role === 'admin' && (
          <Link to="reviews/cycle/new" className="btn primary">
            새 리뷰 사이클
          </Link>
        )}
      </PageHead>

      {active.map((c) => (
        <MyTasks key={c.id} cycle={c} />
      ))}
      {active.length === 0 && <Empty>진행 중인 리뷰가 없어요.</Empty>}

      {me.role === 'admin' && (
        <Card title="사이클 운영">
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>사이클</th>
                <th>상태</th>
                <th>대상자</th>
                <th>작성 현황</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.cycles.map((c) => {
                const rs = data.reviews.filter((r) => r.cycleId === c.id)
                const done = rs.filter((r) => r.status === 'submitted').length
                return (
                  <tr key={c.id}>
                    <td>
                      <b>{c.name}</b>
                      <div className="muted small">
                        {c.period} · 마감 {fmtDate(c.dueDate)}
                      </div>
                    </td>
                    <td>
                      <span className={cx('tag', `cy-${c.status}`)}>{CYCLE_STATUS[c.status]}</span>
                    </td>
                    <td className="num">{c.targetIds.length}명</td>
                    <td style={{ minWidth: 160 }}>
                      <Progress value={rs.length ? (done / rs.length) * 100 : 0} />
                      <span className="muted small">
                        {done}/{rs.length}
                      </span>
                    </td>
                    <td>
                      <Link to={`reviews/cycle/${c.id}`} className="btn small">
                        관리
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
</div>
        </Card>
      )}

      {closed.length > 0 && (
        <Card title="내 지난 결과">
          <ul className="list">
            {closed.map((c) => {
              const s = otherScore(data, c.id, me.id)
              return (
                <li key={c.id} className="row">
                  <span className="grow">
                    {c.name}
                    <span className="muted small">{c.period}</span>
                  </span>
                  <span className="muted small">동료·리더 평균 {s?.toFixed(2) ?? '–'}</span>
                  <GradeChip grade={c.finalGrades[me.id] ?? null} />
                  <Link to={`people/${me.id}`} className="btn small">
                    리포트
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </>
  )
}

function MyTasks({ cycle }: { cycle: Cycle }) {
  const { data, me, user } = useStore()
  const mine = data.reviews.filter((r) => r.cycleId === cycle.id && r.writerId === me.id)
  const done = mine.filter((r) => r.status === 'submitted').length
  const d = daysFrom(cycle.dueDate)
  return (
    <Card
      title={cycle.name}
      action={
        <span className="muted small">
          마감 {fmtDate(cycle.dueDate)} ({d >= 0 ? `D-${d}` : `${-d}일 지남`}) · 내 작성 {done}/{mine.length}
        </span>
      }
    >
      {mine.length === 0 && <Empty>이번 사이클에 내가 쓸 리뷰는 없어요.</Empty>}
      <div className="task-grid">
        {mine
          .sort((a, b) => (a.stage === 'self' ? -1 : b.stage === 'self' ? 1 : 0))
          .map((r) => (
            <Link key={r.id} to={`reviews/write/${r.id}`} className={cx('task', `task-${r.status}`)}>
              <span className="task-stage">{STAGE_LABEL[r.stage]}</span>
              <Person user={user(r.targetId)} plain />
              <span className="task-status">{r.status === 'submitted' ? '제출 완료' : r.status === 'draft' ? '임시 저장' : '작성 전'}</span>
            </Link>
          ))}
      </div>
    </Card>
  )
}
