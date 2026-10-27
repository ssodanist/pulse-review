import { useState } from 'react'
import { useStore } from '../store'
import type { Feedback } from '../types'
import { Card, Empty, PageHead, Person, Tabs } from '../ui'
import { coachReview } from '../lib/ai'
import { cx, fmtDate, today, uid } from '../lib/util'

export const VALUES = ['데이터로 말하기', '고객 중심', '끝까지 책임지기', '함께 성장하기']

export default function FeedbackPage() {
  const { data, me, user } = useStore()
  const [tab, setTab] = useState<'wall' | 'received' | 'sent'>('wall')

  const list = data.feedback
    .filter((f) => (tab === 'wall' ? f.visibility === 'public' && f.kind === 'praise' : tab === 'received' ? f.toId === me.id : f.fromId === me.id))
    .sort((a, b) => b.date.localeCompare(a.date))

  const valueCounts = VALUES.map((v) => [v, data.feedback.filter((f) => f.toId === me.id && f.value === v).length] as const)

  return (
    <>
      <PageHead kicker="피드백" title="잘한 건 바로, 아쉬운 건 구체적으로" />
      <div className="grid-main">
        <div className="stack">
          <Tabs value={tab} onChange={setTab} options={[['wall', '칭찬 보드'], ['received', `받은 피드백`], ['sent', '보낸 피드백']]} />
          {list.length === 0 && <Empty>아직 없어요.</Empty>}
          {list.map((f) => (
            <FeedbackItem key={f.id} f={f} />
          ))}
        </div>
        <div className="stack">
          <Compose />
          <Card title="내가 받은 가치 태그">
            <ul className="list">
              {valueCounts.map(([v, n]) => (
                <li key={v} className="row">
                  <span className="grow">#{v}</span>
                  <b className="num">{n}</b>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )

  function FeedbackItem({ f }: { f: Feedback }) {
    return (
      <article className={cx('fb', `fb-${f.kind}`)}>
        <header className="row">
          <Person user={user(f.fromId)} sub={fmtDate(f.date)} />
          <span className="arrow">→</span>
          <Person user={user(f.toId)} />
          <span className="grow" />
          <span className="tag">{f.kind === 'praise' ? '칭찬' : '조언'}</span>
          {f.visibility === 'private' && <span className="tag tag-muted">비공개</span>}
        </header>
        <p>{f.text}</p>
        {f.value && <span className="value-tag">#{f.value}</span>}
      </article>
    )
  }
}

function Compose() {
  const { data, me, update } = useStore()
  const [toId, setToId] = useState('')
  const [kind, setKind] = useState<Feedback['kind']>('praise')
  const [value, setValue] = useState(VALUES[0])
  const [visibility, setVisibility] = useState<Feedback['visibility']>('public')
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const coach = coachReview(text)

  const send = () => {
    if (!toId || !text.trim()) return
    update((d) => d.feedback.push({ id: uid('f'), fromId: me.id, toId, kind, value, visibility: kind === 'advice' ? 'private' : visibility, text: text.trim(), date: today() }))
    setText('')
    setSent(true)
    setTimeout(() => setSent(false), 2000)
  }

  return (
    <Card title="피드백 보내기">
      <div className="form">
        <select className="input" value={toId} onChange={(e) => setToId(e.target.value)} aria-label="받는 사람">
          <option value="">받는 사람</option>
          {data.users
            .filter((u) => u.id !== me.id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.title}
              </option>
            ))}
        </select>
        <Tabs value={kind} onChange={setKind} options={[['praise', '칭찬'], ['advice', '조언']]} />
        <select className="input" value={value} onChange={(e) => setValue(e.target.value)} aria-label="가치 태그">
          {VALUES.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <textarea
          className="input"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={kind === 'praise' ? '어떤 상황에서 무엇을 했고, 어떤 영향이 있었나요?' : '관찰한 행동과, 다음에 이렇게 하면 좋겠다는 제안을 적어 주세요.'}
        />
        {text.length > 10 && (
          <div className="coach-inline">
            {coach.tips
              .filter((t) => !t.ok)
              .slice(0, 2)
              .map((t) => (
                <span key={t.label} className="muted small">
                  ✦ {t.hint}
                </span>
              ))}
          </div>
        )}
        {kind === 'praise' ? (
          <label className="row small">
            <input type="checkbox" checked={visibility === 'public'} onChange={(e) => setVisibility(e.target.checked ? 'public' : 'private')} />
            칭찬 보드에 공개
          </label>
        ) : (
          <span className="muted small">조언은 받는 사람과 그 리더만 볼 수 있어요.</span>
        )}
        <button className="btn primary" onClick={send} disabled={!toId || !text.trim()}>
          {sent ? '보냈어요' : '보내기'}
        </button>
      </div>
    </Card>
  )
}
