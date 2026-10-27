import type { Cycle, Data, Grade, Review, Stage, User } from '../types'
import { uid } from './util'

export const STAGE_LABEL: Record<Stage, string> = {
  self: '셀프 리뷰',
  peer: '동료 리뷰',
  down1: '1차 리더 리뷰',
  down2: '2차 리더 리뷰',
}

export const GRADES: Grade[] = ['S', 'A', 'B', 'C']

/** 대상자마다 단계별 작성자를 정해 리뷰 과제를 만든다. 동료는 최대 2명. */
export function buildReviews(cycle: Cycle, users: User[]): Review[] {
  const byId = new Map(users.map((u) => [u.id, u]))
  const out: Review[] = []
  const push = (stage: Stage, writerId: string, targetId: string) =>
    out.push({ id: uid('rv'), cycleId: cycle.id, stage, writerId, targetId, answers: {}, status: 'todo' })

  for (const targetId of cycle.targetIds) {
    const t = byId.get(targetId)
    if (!t) continue
    if (cycle.stages.includes('self')) push('self', t.id, t.id)
    if (cycle.stages.includes('peer')) {
      // 동료 = 같은 리더 아래에 있는 사람 (팀원이 자기 리더를 동료로 평가하지 않도록)
      users
        .filter((u) => u.managerId === t.managerId && u.id !== t.id && cycle.targetIds.includes(u.id))
        .slice(0, 2)
        .forEach((p) => push('peer', p.id, t.id))
    }
    const m1 = t.managerId ? byId.get(t.managerId) : undefined
    if (m1 && cycle.stages.includes('down1')) push('down1', m1.id, t.id)
    const m2 = m1?.managerId ? byId.get(m1.managerId) : undefined
    if (m2 && cycle.stages.includes('down2')) push('down2', m2.id, t.id)
  }
  return out
}

/** 셀프를 제외한 척도 점수 평균 (1~5). */
export function otherScore(data: Data, cycleId: string, targetId: string): number | null {
  return avgScore(data.reviews.filter((r) => r.cycleId === cycleId && r.targetId === targetId && r.stage !== 'self' && r.status === 'submitted'))
}

export function selfScore(data: Data, cycleId: string, targetId: string): number | null {
  return avgScore(data.reviews.filter((r) => r.cycleId === cycleId && r.targetId === targetId && r.stage === 'self' && r.status === 'submitted'))
}

function avgScore(reviews: Review[]): number | null {
  const s = reviews.flatMap((r) => Object.values(r.answers).map((a) => a.score).filter((x): x is number => typeof x === 'number'))
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null
}

/** 점수로 제안 등급을 매긴다. 확정 등급은 캘리브레이션에서 사람이 정한다. */
export function suggestGrade(score: number | null): Grade | null {
  if (score == null) return null
  if (score >= 4.4) return 'S'
  if (score >= 3.8) return 'A'
  if (score >= 3.0) return 'B'
  return 'C'
}

/** 권장 분포 (S 10% / A 25% / B 50% / C 15%) */
export const GUIDE: Record<Grade, number> = { S: 0.1, A: 0.25, B: 0.5, C: 0.15 }
