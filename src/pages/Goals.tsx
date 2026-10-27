import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import type { Objective, ObjectiveLevel, ObjectiveStatus } from '../types'
import { Avatar, Modal, PageHead, Progress, StatusTag, Tabs } from '../ui'
import { cx, fmtDate, today, uid } from '../lib/util'

/** 핵심결과의 달성률 평균. "낮을수록 좋은" 지표는 target<시작값으로 판단하기 어려워 current/target 비율을 뒤집어 계산한다. */
export function objectiveProgress(o: Objective): number {
  if (o.status === 'done') return 100
  if (!o.keyResults.length) return o.checkins.at(-1)?.progress ?? 0
  const rates = o.keyResults.map((k) => {
    const lowerIsBetter = /(이탈|시간|단계|LCP)/.test(k.title)
    const r = lowerIsBetter ? k.target / Math.max(k.current, 0.0001) : k.current / Math.max(k.target, 0.0001)
    return Math.min(1, r)
  })
  return Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100)
}

const LEVEL_LABEL: Record<ObjectiveLevel, string> = { company: '회사', team: '팀', personal: '개인' }

export default function Goals() {
  const { data, me } = useStore()
  const [filter, setFilter] = useState<'all' | 'mine' | 'risk'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const visible = (o: Objective) => filter === 'all' || (filter === 'mine' ? o.ownerId === me.id : o.status === 'risk')
  const roots = data.objectives.filter((o) => !o.parentId)
  const counts = { on: 0, risk: 0, done: 0 } as Record<ObjectiveStatus, number>
  data.objectives.forEach((o) => counts[o.status]++)

  return (
    <>
      <PageHead kicker="2026 상반기" title="목표 지도">
        <button className="btn primary" onClick={() => setCreating(true)}>
          목표 추가
        </button>
      </PageHead>
      <div className="stat-row">
        <Stat label="전체 목표" value={data.objectives.length} />
        <Stat label="순항" value={counts.on} tone="ok" />
        <Stat label="지연" value={counts.risk} tone="warn" />
        <Stat label="완료" value={counts.done} />
      </div>
      <Tabs value={filter} onChange={setFilter} options={[['all', '전체 정렬'], ['mine', '내 목표'], ['risk', '지연된 목표']]} />
      <div className="tree">
        {roots.map((o) => (
          <Node key={o.id} o={o} depth={0} visible={visible} onOpen={setOpen} />
        ))}
      </div>
      {open && <GoalDetail id={open} onClose={() => setOpen(null)} />}
      {creating && <NewGoal onClose={() => setCreating(false)} />}
    </>
  )
}

export function Stat({ label, value, tone, sub }: { label: string; value: ReactNode; tone?: 'ok' | 'warn'; sub?: string }) {
  return (
    <div className={cx('stat', tone && `stat-${tone}`)}>
      <div className="stat-v">{value}</div>
      <div className="stat-l">{label}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  )
}

function Node({ o, depth, visible, onOpen }: { o: Objective; depth: number; visible: (o: Objective) => boolean; onOpen: (id: string) => void }) {
  const { data, user } = useStore()
  const kids = data.objectives.filter((c) => c.parentId === o.id)
  const show = visible(o)
  const anyKid = (x: Objective): boolean => visible(x) || data.objectives.filter((c) => c.parentId === x.id).some(anyKid)
  if (!show && !kids.some(anyKid)) return null
  const p = objectiveProgress(o)
  return (
    <div className={cx('tree-node', `lv-${o.level}`)} style={{ marginLeft: depth * 28 }}>
      <button className={cx('goal-row', !show && 'dim')} onClick={() => onOpen(o.id)}>
        <span className="lv">{LEVEL_LABEL[o.level]}</span>
        <span className="grow goal-title">{o.title}</span>
        <Avatar user={user(o.ownerId)} size={24} />
        <span className="goal-p">
          <Progress value={p} status={o.status} />
          <span className="num">{p}%</span>
        </span>
        <StatusTag status={o.status} />
      </button>
      {kids.map((k) => (
        <Node key={k.id} o={k} depth={1} visible={visible} onOpen={onOpen} />
      ))}
    </div>
  )
}

function GoalDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, me, update, user } = useStore()
  const o = data.objectives.find((x) => x.id === id)!
  const [note, setNote] = useState('')
  const [krs, setKrs] = useState(() => Object.fromEntries(o.keyResults.map((k) => [k.id, k.current])))
  const [status, setStatus] = useState<ObjectiveStatus>(o.status)
  const canEdit = o.ownerId === me.id || me.role === 'admin' || user(o.ownerId)?.managerId === me.id
  const parent = data.objectives.find((x) => x.id === o.parentId)

  const save = () =>
    update((d) => {
      const t = d.objectives.find((x) => x.id === id)!
      t.keyResults.forEach((k) => (k.current = Number(krs[k.id])))
      t.status = status
      t.checkins.push({ id: uid('ci'), date: today(), authorId: me.id, progress: objectiveProgress(t), note: note.trim() || '진척도 업데이트' })
      setNote('')
    })

  return (
    <Modal title={o.title} onClose={onClose}>
      <p className="muted">
        {LEVEL_LABEL[o.level]} 목표 · {user(o.ownerId)?.name} · {o.period}
        {parent && <> · 상위: {parent.title}</>}
      </p>
      <h4>핵심 결과</h4>
      <ul className="list">
        {o.keyResults.map((k) => (
          <li key={k.id} className="row">
            <span className="grow">{k.title}</span>
            {canEdit ? (
              <input className="input num-in" type="number" value={krs[k.id]} onChange={(e) => setKrs({ ...krs, [k.id]: Number(e.target.value) })} aria-label={`${k.title} 현재값`} />
            ) : (
              <b>{k.current}</b>
            )}
            <span className="muted">
              / {k.target}
              {k.unit}
            </span>
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="checkin-form">
          <h4>체크인</h4>
          <Tabs value={status} onChange={setStatus} options={[['on', '순항'], ['risk', '지연'], ['done', '완료']]} />
          <textarea className="input" rows={3} placeholder="이번 주에 무엇이 바뀌었나요? 막힌 점은?" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn primary" onClick={save}>
            체크인 저장
          </button>
        </div>
      )}
      <h4>체크인 기록</h4>
      <ol className="timeline">
        {[...o.checkins].reverse().map((c) => (
          <li key={c.id}>
            <span className="muted small">
              {fmtDate(c.date)} · {user(c.authorId)?.name} · {c.progress}%
            </span>
            <p>{c.note}</p>
          </li>
        ))}
      </ol>
    </Modal>
  )
}

function NewGoal({ onClose }: { onClose: () => void }) {
  const { data, me, update } = useStore()
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState<ObjectiveLevel>(me.role === 'member' ? 'personal' : 'team')
  const [parentId, setParentId] = useState('')
  const [kr, setKr] = useState({ title: '', target: 100, unit: '%' })
  const parents = data.objectives.filter((o) => (level === 'team' ? o.level === 'company' : level === 'personal' ? o.level === 'team' : false))

  const submit = () => {
    if (!title.trim()) return
    update((d) =>
      d.objectives.push({
        id: uid('o'),
        title: title.trim(),
        level,
        ownerId: me.id,
        parentId: parentId || undefined,
        period: '2026 상반기',
        status: 'on',
        keyResults: kr.title ? [{ id: uid('k'), title: kr.title, current: 0, target: kr.target, unit: kr.unit }] : [],
        checkins: [],
      }),
    )
    onClose()
  }

  return (
    <Modal title="새 목표" onClose={onClose}>
      <div className="form">
        <label>
          수준
          <Tabs value={level} onChange={setLevel} options={me.role === 'member' ? [['personal', '개인']] : [['company', '회사'], ['team', '팀'], ['personal', '개인']]} />
        </label>
        <label>
          목표
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 신규 고객 온보딩 완료율을 높인다" />
        </label>
        {parents.length > 0 && (
          <label>
            정렬할 상위 목표
            <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">없음</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          핵심 결과 (선택)
          <div className="row">
            <input className="input grow" value={kr.title} onChange={(e) => setKr({ ...kr, title: e.target.value })} placeholder="예: 온보딩 완료율" />
            <input className="input num-in" type="number" value={kr.target} onChange={(e) => setKr({ ...kr, target: Number(e.target.value) })} aria-label="목표값" />
            <input className="input unit-in" value={kr.unit} onChange={(e) => setKr({ ...kr, unit: e.target.value })} aria-label="단위" />
          </div>
        </label>
        <button className="btn primary" onClick={submit} disabled={!title.trim()}>
          추가
        </button>
      </div>
    </Modal>
  )
}

