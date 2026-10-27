import { useState } from 'react'
import { reportsOf, useStore } from '../store'
import { Card, Empty, Link, Modal, PageHead, Person, Progress, StatusTag, go } from '../ui'
import { summarizeWithAi, type AiResult } from '../lib/ai'
import type { AiSummary } from '../lib/ai-types'
import { cx, fmtDate, today, uid } from '../lib/util'
import { objectiveProgress } from './Goals'

export default function OneOnOnes({ id }: { id?: string }) {
  const { data, me, user } = useStore()
  const [creating, setCreating] = useState(false)
  const mine = data.meetings.filter((m) => m.leaderId === me.id || m.memberId === me.id).sort((a, b) => b.date.localeCompare(a.date))
  const current = mine.find((m) => m.id === id) ?? mine[0]

  return (
    <>
      <PageHead kicker="1:1 미팅" title="대화에 집중하고, 기록은 남기세요">
        {reportsOf(data, me.id).length > 0 && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            1:1 잡기
          </button>
        )}
      </PageHead>
      <div className="split">
        <aside className="side-list">
          {mine.length === 0 && <Empty>아직 1:1이 없어요.</Empty>}
          {mine.map((m) => {
            const other = user(m.leaderId === me.id ? m.memberId : m.leaderId)
            return (
              <Link key={m.id} to={`1on1/${m.id}`} className={cx('side-item', current?.id === m.id && 'on')}>
                <Person user={other} sub={`${fmtDate(m.date)}${m.date >= today() ? ' · 예정' : ''}`} plain />
              </Link>
            )
          })}
        </aside>
        {current ? <MeetingDetail key={current.id} id={current.id} /> : <Empty>왼쪽에서 1:1을 선택하세요.</Empty>}
      </div>
      {creating && <NewMeeting onClose={() => setCreating(false)} />}
    </>
  )
}

function MeetingDetail({ id }: { id: string }) {
  const { data, me, update, user } = useStore()
  const m = data.meetings.find((x) => x.id === id)!
  const [agendaText, setAgendaText] = useState('')
  const [actionText, setActionText] = useState('')
  const [ai, setAi] = useState<AiResult<AiSummary> | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const member = user(m.memberId)
  const leader = user(m.leaderId)
  const goals = data.objectives.filter((o) => o.ownerId === m.memberId)
  const fb = data.feedback.filter((f) => f.toId === m.memberId && (f.visibility === 'public' || me.id === m.leaderId || me.id === f.toId)).slice(-3)
  const prev = data.meetings.filter((x) => x.memberId === m.memberId && x.leaderId === m.leaderId && x.date < m.date).sort((a, b) => b.date.localeCompare(a.date))[0]
  const carry = prev?.actions.filter((a) => !a.done) ?? []

  const mut = (fn: (x: typeof m) => void) => update((d) => fn(d.meetings.find((x) => x.id === id)!))

  return (
    <div className="grid-main">
      <div className="stack">
        <Card title={<>{leader?.name} ↔ {member?.name} · {fmtDate(m.date)}</>}>
          <h4>어젠다</h4>
          <ul className="list">
            {m.agenda.map((a) => (
              <li key={a.id} className="row">
                <input type="checkbox" checked={a.done} onChange={() => mut((x) => (x.agenda.find((y) => y.id === a.id)!.done = !a.done))} aria-label={a.text} />
                <span className={cx('grow', a.done && 'done')}>{a.text}</span>
              </li>
            ))}
          </ul>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              if (!agendaText.trim()) return
              mut((x) => x.agenda.push({ id: uid('a'), text: agendaText.trim(), done: false }))
              setAgendaText('')
            }}
          >
            <input className="input grow" placeholder="이야기할 주제 추가" value={agendaText} onChange={(e) => setAgendaText(e.target.value)} />
            <button className="btn">추가</button>
          </form>
        </Card>
        <Card
          title="미팅 노트"
          action={
            <button
              className="btn small"
              disabled={!m.notes.trim() || summarizing}
              onClick={async () => {
                setSummarizing(true)
                setAi(await summarizeWithAi(m.notes, leader?.name ?? '', member?.name ?? '', m.agenda.map((a) => a.text)))
                setSummarizing(false)
              }}
            >
              {summarizing ? 'Claude가 정리하는 중…' : '✦ 요약하고 할 일 뽑기'}
            </button>
          }
        >
          <textarea
            className="input notes"
            rows={8}
            placeholder="대화 중 나온 이야기, 결정, 다음에 챙길 것을 자유롭게 적으세요."
            value={m.notes}
            onChange={(e) => mut((x) => (x.notes = e.target.value))}
          />
          {ai && (
            <div className="ai-box">
              <div className="ai-label">
                ✦ {ai.source === 'claude' ? 'Claude 요약' : '자동 요약 (규칙 기반)'}
                {ai.error && <span className="ai-err"> · {ai.error}</span>}
              </div>
              <ul>
                {ai.value.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              {ai.value.actions.length > 0 && (
                <>
                  <div className="ai-label">제안된 액션 아이템</div>
                  {ai.value.actions.map((a, i) => {
                    const ownerId = a.owner === 'leader' ? m.leaderId : m.memberId
                    return (
                      <div key={i} className="row">
                        <span className="grow">{a.text}</span>
                        <span className="muted small">{user(ownerId)?.name}</span>
                        <button
                          className="btn small"
                          onClick={() => {
                            mut((x) => x.actions.push({ id: uid('x'), text: a.text, ownerId, done: false }))
                            setAi({ ...ai, value: { ...ai.value, actions: ai.value.actions.filter((_, j) => j !== i) } })
                          }}
                        >
                          추가
                        </button>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </Card>
        <Card title="액션 아이템">
          {carry.length > 0 && <p className="muted small">지난 1:1({fmtDate(prev!.date)})에서 남은 일: {carry.map((c) => c.text).join(', ')}</p>}
          <ul className="list">
            {m.actions.map((a) => (
              <li key={a.id} className="row">
                <input type="checkbox" checked={a.done} onChange={() => mut((x) => (x.actions.find((y) => y.id === a.id)!.done = !a.done))} aria-label={a.text} />
                <span className={cx('grow', a.done && 'done')}>{a.text}</span>
                <span className="muted small">{user(a.ownerId)?.name}</span>
              </li>
            ))}
          </ul>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              if (!actionText.trim()) return
              mut((x) => x.actions.push({ id: uid('x'), text: actionText.trim(), ownerId: m.memberId, done: false }))
              setActionText('')
            }}
          >
            <input className="input grow" placeholder="할 일 추가" value={actionText} onChange={(e) => setActionText(e.target.value)} />
            <button className="btn">추가</button>
          </form>
        </Card>
      </div>
      <div className="stack">
        <Card title={`${member?.name} 님의 지금`}>
          <h4>목표</h4>
          {goals.length === 0 && <Empty>목표 없음</Empty>}
          {goals.map((o) => (
            <div key={o.id} className="goal-mini">
              <div className="row">
                <span className="grow small">{o.title}</span>
                <StatusTag status={o.status} />
              </div>
              <Progress value={objectiveProgress(o)} status={o.status} />
            </div>
          ))}
          <h4>최근 피드백</h4>
          {fb.length === 0 && <Empty>피드백 없음</Empty>}
          {fb.map((f) => (
            <blockquote key={f.id} className="quote small">
              <p>{f.text}</p>
              <footer>
                {user(f.fromId)?.name} · {f.kind === 'praise' ? '칭찬' : '조언'}
              </footer>
            </blockquote>
          ))}
        </Card>
      </div>
    </div>
  )
}

function NewMeeting({ onClose }: { onClose: () => void }) {
  const { data, me, update } = useStore()
  const reports = reportsOf(data, me.id)
  const [memberId, setMemberId] = useState(reports[0]?.id ?? '')
  const [date, setDate] = useState(today())
  return (
    <Modal title="1:1 잡기" onClose={onClose}>
      <div className="form">
        <label>
          구성원
          <select className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {reports.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          날짜
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button
          className="btn primary"
          onClick={() => {
            const nid = uid('m')
            update((d) => d.meetings.push({ id: nid, leaderId: me.id, memberId, date, agenda: [], notes: '', actions: [] }))
            onClose()
            go(`1on1/${nid}`)
          }}
        >
          만들기
        </button>
      </div>
    </Modal>
  )
}
