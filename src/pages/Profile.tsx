import { reportsOf, useStore } from '../store'
import type { Data } from '../types'
import { Avatar, Card, Empty, GradeChip, PageHead, Progress, StatusTag } from '../ui'
import { STAGE_LABEL, otherScore, selfScore } from '../lib/cycle'
import { avg, cx } from '../lib/util'
import { objectiveProgress } from './Goals'

/** 역량별 점수: 셀프 / 타인 / 같은 팀 동료의 타인 평가 평균 */
function competencyScores(data: Data, cycleId: string, targetId: string) {
  const cycle = data.cycles.find((c) => c.id === cycleId)!
  const target = data.users.find((u) => u.id === targetId)!
  const teammates = data.users.filter((u) => u.teamId === target.teamId && u.id !== targetId && cycle.targetIds.includes(u.id))
  const submitted = data.reviews.filter((r) => r.cycleId === cycleId && r.status === 'submitted')
  const score = (ids: string[], self: boolean, qid: string) =>
    avg(
      submitted
        .filter((r) => ids.includes(r.targetId) && (self ? r.stage === 'self' : r.stage !== 'self'))
        .map((r) => r.answers[qid]?.score)
        .filter((x): x is number => typeof x === 'number'),
    )
  return cycle.questions
    .filter((q) => q.type === 'scale')
    .map((q) => ({
      name: q.competency ?? q.text,
      self: score([targetId], true, q.id),
      other: score([targetId], false, q.id),
      team: score(teammates.map((t) => t.id), false, q.id),
    }))
}

export default function Profile({ id }: { id: string }) {
  const { data, me, user } = useStore()
  const u = user(id)
  if (!u) return <Empty>구성원을 찾을 수 없어요.</Empty>
  const canSee = me.id === id || me.role === 'admin' || reportsOf(data, me.id).some((r) => r.id === id)
  const team = data.teams.find((t) => t.id === u.teamId)
  const goals = data.objectives.filter((o) => o.ownerId === id)

  if (!canSee)
    return (
      <>
        <Header />
        <Card title="목표">
          <Goals />
        </Card>
        <p className="notice">평가 정보는 본인, 리더, HR만 볼 수 있어요.</p>
      </>
    )

  // 구성원 본인은 종료된 사이클만, 리더·HR은 진행 중 사이클도 본다
  const cycles = data.cycles.filter((c) => c.targetIds.includes(id) && (c.status === 'closed' || me.id !== id))
  const latest = cycles.find((c) => otherScore(data, c.id, id) != null)
  const comps = latest ? competencyScores(data, latest.id, id) : []
  const ranked = [...comps].filter((c) => c.other != null).sort((a, b) => b.other! - a.other!)
  const self = latest ? selfScore(data, latest.id, id) : null
  const other = latest ? otherScore(data, latest.id, id) : null
  const gapItem = [...comps].filter((c) => c.self != null && c.other != null).sort((a, b) => Math.abs(b.self! - b.other!) - Math.abs(a.self! - a.other!))[0]
  const comments = latest
    ? data.reviews.filter((r) => r.cycleId === latest.id && r.targetId === id && r.stage !== 'self' && r.status === 'submitted')
    : []
  const textQs = latest?.questions.filter((q) => q.type === 'text') ?? []
  const fb = data.feedback.filter((f) => f.toId === id)

  return (
    <>
      <Header />
      {!latest && <Empty>아직 볼 수 있는 리뷰 결과가 없어요.</Empty>}
      {latest && (
        <>
          <div className="stat-row">
            <div className="stat">
              <div className="stat-v">{other?.toFixed(2) ?? '–'}</div>
              <div className="stat-l">타인 평가 · {latest.name}</div>
            </div>
            <div className="stat">
              <div className="stat-v">{self?.toFixed(2) ?? '–'}</div>
              <div className="stat-l">자기 평가</div>
            </div>
            <div className={cx('stat', self != null && other != null && Math.abs(self - other) >= 0.5 && 'stat-warn')}>
              <div className="stat-v">{self != null && other != null ? (self - other > 0 ? '+' : '') + (self - other).toFixed(2) : '–'}</div>
              <div className="stat-l">자기객관화 차이</div>
            </div>
            <div className="stat">
              <div className="stat-v">
                <GradeChip grade={latest.finalGrades[id] ?? null} />
              </div>
              <div className="stat-l">확정 등급</div>
            </div>
          </div>
          <div className="grid-2">
            <Card title="역량 지도">
              <Radar comps={comps} />
              <div className="row small legend">
                <span><i className="sw sw-other" /> 타인 평가</span>
                <span><i className="sw sw-self" /> 자기 평가</span>
                <span><i className="sw sw-team" /> 팀 평균</span>
              </div>
            </Card>
            <Card title="✦ 강점과 보완점">
              <h4>강점</h4>
              {ranked.slice(0, 2).map((c) => (
                <p key={c.name} className="row">
                  <b className="grow">{c.name}</b>
                  <span className="num">{c.other!.toFixed(2)}</span>
                  <span className="muted small">팀 {c.team?.toFixed(2) ?? '–'}</span>
                </p>
              ))}
              <h4>보완점</h4>
              {ranked.slice(-2).reverse().map((c) => (
                <p key={c.name} className="row">
                  <b className="grow">{c.name}</b>
                  <span className="num">{c.other!.toFixed(2)}</span>
                  <span className="muted small">팀 {c.team?.toFixed(2) ?? '–'}</span>
                </p>
              ))}
              {gapItem && Math.abs(gapItem.self! - gapItem.other!) >= 0.5 && (
                <p className="ai-box small">
                  ✦ '{gapItem.name}'에서 자기 평가({gapItem.self!.toFixed(1)})와 타인 평가({gapItem.other!.toFixed(1)})의 차이가 가장 커요.
                  {gapItem.self! > gapItem.other! ? ' 스스로 생각하는 것보다 주변에 덜 드러나고 있을 수 있어요.' : ' 스스로를 낮게 보고 있어요. 주변은 더 높게 평가해요.'}
                </p>
              )}
            </Card>
          </div>
          <Card title="받은 리뷰 코멘트">
            {comments.length === 0 && <Empty>코멘트 없음</Empty>}
            <div className="grid-2">
              {comments.map((r) => (
                <div key={r.id} className="comment">
                  <span className="muted small">{r.stage === 'peer' ? '동료 (익명)' : `${STAGE_LABEL[r.stage]} · ${user(r.writerId)?.name}`}</span>
                  {textQs.map((q) => r.answers[q.id]?.text && <p key={q.id} className="small">{r.answers[q.id].text}</p>)}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
      <div className="grid-2">
        <Card title="평가 이력">
          <ul className="list">
            {cycles.map((c) => (
              <li key={c.id} className="row">
                <span className="grow">
                  {c.name}
                  <span className="muted small">{c.status === 'closed' ? '확정' : '진행 중'}</span>
                </span>
                <span className="num">{otherScore(data, c.id, id)?.toFixed(2) ?? '–'}</span>
                <GradeChip grade={c.finalGrades[id] ?? null} faded={c.status !== 'closed'} />
              </li>
            ))}
          </ul>
        </Card>
        <Card title="목표">
          <Goals />
        </Card>
      </div>
      <Card title={`받은 피드백 ${fb.length}`}>
        {fb.map((f) => (
          <blockquote key={f.id} className="quote small">
            <p>{f.text}</p>
            <footer>
              {user(f.fromId)?.name} · {f.kind === 'praise' ? '칭찬' : '조언'} {f.value && `· #${f.value}`}
            </footer>
          </blockquote>
        ))}
      </Card>
    </>
  )

  function Header() {
    return (
      <PageHead kicker="인사카드" title={<span className="row"><Avatar user={u} size={44} /> {u!.name}</span>}>
        <span className="muted">
          {u!.title} · {team?.name} · 리더 {user(u!.managerId)?.name ?? '–'}
        </span>
      </PageHead>
    )
  }

  function Goals() {
    if (!goals.length) return <Empty>목표 없음</Empty>
    return (
      <>
        {goals.map((o) => (
          <div key={o.id} className="goal-mini">
            <div className="row">
              <span className="grow small">{o.title}</span>
              <StatusTag status={o.status} />
            </div>
            <Progress value={objectiveProgress(o)} status={o.status} />
          </div>
        ))}
      </>
    )
  }
}

function Radar({ comps }: { comps: { name: string; self: number | null; other: number | null; team: number | null }[] }) {
  const n = comps.length
  if (n < 3) return <Empty>역량 문항이 3개 이상일 때 보여요.</Empty>
  const R = 110
  const C = 150
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [C + Math.cos(a) * R * (v / 5), C + Math.sin(a) * R * (v / 5)]
  }
  const poly = (key: 'self' | 'other' | 'team') => comps.map((c, i) => pt(i, c[key] ?? 0).join(',')).join(' ')
  return (
    <svg viewBox="0 0 300 300" className="radar" role="img" aria-label="역량 레이더 차트">
      {[1, 2, 3, 4, 5].map((l) => (
        <polygon key={l} points={comps.map((_, i) => pt(i, l).join(',')).join(' ')} className="radar-grid" />
      ))}
      {comps.map((c, i) => {
        const [x, y] = pt(i, 5.9)
        return (
          <text key={c.name} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="radar-label">
            {c.name}
          </text>
        )
      })}
      <polygon points={poly('team')} className="radar-team" />
      <polygon points={poly('self')} className="radar-self" />
      <polygon points={poly('other')} className="radar-other" />
    </svg>
  )
}
