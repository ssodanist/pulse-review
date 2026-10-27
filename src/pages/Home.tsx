import { useStore } from '../store'
import { Card, Empty, Link, PageHead, Person, Progress, StatusTag } from '../ui'
import { STAGE_LABEL } from '../lib/cycle'
import { daysFrom, fmtDate, today } from '../lib/util'
import { objectiveProgress } from './Goals'

export default function Home() {
  const { data, me, user } = useStore()
  const myReviews = data.reviews.filter((r) => r.writerId === me.id && r.status !== 'submitted' && data.cycles.find((c) => c.id === r.cycleId)?.status === 'writing')
  const upcoming = data.meetings.filter((m) => (m.leaderId === me.id || m.memberId === me.id) && m.date >= today()).sort((a, b) => a.date.localeCompare(b.date))
  const openActions = data.meetings.flatMap((m) => m.actions.filter((a) => a.ownerId === me.id && !a.done).map((a) => ({ ...a, meeting: m })))
  const goals = data.objectives.filter((o) => o.ownerId === me.id)
  const stale = goals.filter((o) => o.status !== 'done' && daysFrom(o.checkins.at(-1)?.date ?? '2000-01-01') < -14)
  const surveys = data.surveys.filter((s) => s.status === 'open' && !s.responses.some((r) => r.userId === me.id))
  const received = data.feedback.filter((f) => f.toId === me.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  const todo = myReviews.length + surveys.length + stale.length + openActions.length

  return (
    <>
      <PageHead kicker={fmtDate(today())} title={<>{me.name} 님, 오늘 챙길 일이 {todo}개 있어요</>} />
      <div className="grid-2">
        <div className="stack">
          <Card title="할 일">
            <ul className="list">
              {myReviews.map((r) => {
                const cycle = data.cycles.find((c) => c.id === r.cycleId)!
                return (
                  <li key={r.id} className="row">
                    <span className="dot dot-accent" />
                    <span className="grow">
                      <Link to={`reviews/write/${r.id}`}>
                        {r.stage === 'self' ? '셀프 리뷰 작성' : `${user(r.targetId)?.name} 님 ${STAGE_LABEL[r.stage]}`}
                      </Link>
                      <span className="muted small">{cycle.name}</span>
                    </span>
                    <span className="due">D{daysFrom(cycle.dueDate) >= 0 ? '-' : '+'}{Math.abs(daysFrom(cycle.dueDate))}</span>
                  </li>
                )
              })}
              {surveys.map((s) => (
                <li key={s.id} className="row">
                  <span className="dot dot-blue" />
                  <span className="grow">
                    <Link to={`surveys/${s.id}`}>{s.title} 응답하기</Link>
                    <span className="muted small">익명으로 집계돼요</span>
                  </span>
                </li>
              ))}
              {stale.map((o) => (
                <li key={o.id} className="row">
                  <span className="dot dot-warn" />
                  <span className="grow">
                    <Link to="goals">'{o.title}' 체크인하기</Link>
                    <span className="muted small">마지막 체크인 {fmtDate(o.checkins.at(-1)?.date ?? today())}</span>
                  </span>
                </li>
              ))}
              {openActions.map((a) => (
                <li key={a.id} className="row">
                  <span className="dot" />
                  <span className="grow">
                    <Link to={`1on1/${a.meeting.id}`}>{a.text}</Link>
                    <span className="muted small">1:1 액션 아이템 · {fmtDate(a.meeting.date)}</span>
                  </span>
                </li>
              ))}
              {todo === 0 && <Empty>밀린 일이 없어요.</Empty>}
            </ul>
          </Card>
          <Card title="다가오는 1:1" action={<Link to="1on1" className="btn ghost small">전체 보기</Link>}>
            {upcoming.length === 0 && <Empty>예정된 1:1이 없어요.</Empty>}
            <ul className="list">
              {upcoming.map((m) => {
                const other = user(m.leaderId === me.id ? m.memberId : m.leaderId)
                return (
                  <li key={m.id} className="row">
                    <Person user={other} sub={`${fmtDate(m.date)} · 어젠다 ${m.agenda.length}개`} />
                    <Link to={`1on1/${m.id}`} className="btn small">준비하기</Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
        <div className="stack">
          <Card title="내 목표" action={<Link to="goals" className="btn ghost small">목표로</Link>}>
            {goals.length === 0 && <Empty>등록된 목표가 없어요.</Empty>}
            <ul className="list">
              {goals.map((o) => (
                <li key={o.id} className="goal-mini">
                  <div className="row">
                    <span className="grow">{o.title}</span>
                    <StatusTag status={o.status} />
                  </div>
                  <Progress value={objectiveProgress(o)} status={o.status} />
                </li>
              ))}
            </ul>
          </Card>
          <Card title="최근 받은 피드백" action={<Link to="feedback" className="btn ghost small">피드백으로</Link>}>
            {received.length === 0 && <Empty>아직 받은 피드백이 없어요.</Empty>}
            {received.map((f) => (
              <blockquote key={f.id} className="quote">
                <p>{f.text}</p>
                <footer>
                  {user(f.fromId)?.name} · {f.kind === 'praise' ? '칭찬' : '조언'}
                  {f.value && ` · #${f.value}`}
                </footer>
              </blockquote>
            ))}
          </Card>
        </div>
      </div>
    </>
  )
}
