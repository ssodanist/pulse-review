import { useEffect, useState, type ReactNode } from 'react'
import type { Grade, ObjectiveStatus, User } from './types'
import { cx } from './lib/util'

export function useRoute(): string[] {
  const get = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/')
  const [parts, setParts] = useState(get)
  useEffect(() => {
    const on = () => {
      setParts(get())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return parts
}

export const go = (path: string) => {
  location.hash = '/' + path
}

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <a href={'#/' + to} className={className}>
      {children}
    </a>
  )
}

export function Avatar({ user, size = 28 }: { user?: User; size?: number }) {
  if (!user) return null
  return (
    <span
      className="avatar"
      title={user.name}
      style={{ width: size, height: size, fontSize: size * 0.42, background: `oklch(0.86 0.06 ${user.hue})`, color: `oklch(0.32 0.08 ${user.hue})` }}
    >
      {user.name.slice(-2)}
    </span>
  )
}

/** plain: 이미 링크 안에 있을 때 이름을 링크로 만들지 않는다 */
export function Person({ user, sub, plain }: { user?: User; sub?: ReactNode; plain?: boolean }) {
  if (!user) return null
  return (
    <span className="person">
      <Avatar user={user} />
      <span>
        {plain ? (
          <span className="person-name">{user.name}</span>
        ) : (
          <Link to={`people/${user.id}`} className="person-name">
            {user.name}
          </Link>
        )}
        <span className="muted small">{sub ?? user.title}</span>
      </span>
    </span>
  )
}

export function Progress({ value, status }: { value: number; status?: ObjectiveStatus }) {
  return (
    <span className={cx('progress', status && `st-${status}`)}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  )
}

const STATUS_LABEL: Record<ObjectiveStatus, string> = { on: '순항', risk: '지연', done: '완료' }
export function StatusTag({ status }: { status: ObjectiveStatus }) {
  return <span className={cx('tag', `tag-${status}`)}>{STATUS_LABEL[status]}</span>
}

export function GradeChip({ grade, faded }: { grade: Grade | null; faded?: boolean }) {
  if (!grade) return <span className="grade grade-none">–</span>
  return <span className={cx('grade', `grade-${grade}`, faded && 'faded')}>{grade}</span>
}

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <header className="card-head">
          {title && <h3>{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHead({ kicker, title, children }: { kicker?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {kicker && <div className="kicker">{kicker}</div>}
        <h1>{title}</h1>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Scale({ value, onChange, disabled }: { value?: number; onChange: (v: number) => void; disabled?: boolean }) {
  const labels = ['매우 미흡', '미흡', '보통', '우수', '매우 우수']
  return (
    <div className="scale" role="radiogroup">
      {labels.map((l, i) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === i + 1}
          disabled={disabled}
          className={cx('scale-btn', value === i + 1 && 'on')}
          onClick={() => onChange(i + 1)}
        >
          <b>{i + 1}</b>
          <span>{l}</span>
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="card-head">
          <h3>{title}</h3>
          <button className="btn ghost" onClick={onClose} aria-label="닫기">
            닫기
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="tabs">
      {options.map(([k, l]) => (
        <button key={k} className={cx('tab', value === k && 'on')} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  )
}
