export type Role = 'admin' | 'leader' | 'member'

export interface User {
  id: string
  name: string
  title: string
  teamId: string
  role: Role
  managerId?: string
  salary: number // 만원 단위
  hue: number
}

export interface Team {
  id: string
  name: string
  leaderId: string
}

export interface KeyResult {
  id: string
  title: string
  current: number
  target: number
  unit: string
}

export interface CheckIn {
  id: string
  date: string
  authorId: string
  progress: number
  note: string
}

export type ObjectiveLevel = 'company' | 'team' | 'personal'
export type ObjectiveStatus = 'on' | 'risk' | 'done'

export interface Objective {
  id: string
  title: string
  level: ObjectiveLevel
  ownerId: string
  parentId?: string
  period: string
  status: ObjectiveStatus
  keyResults: KeyResult[]
  checkins: CheckIn[]
}

export interface Meeting {
  id: string
  leaderId: string
  memberId: string
  date: string
  agenda: { id: string; text: string; done: boolean }[]
  notes: string
  actions: { id: string; text: string; ownerId: string; done: boolean }[]
}

export interface Feedback {
  id: string
  fromId: string
  toId: string
  kind: 'praise' | 'advice'
  text: string
  value?: string
  visibility: 'public' | 'private'
  date: string
}

export type Stage = 'self' | 'peer' | 'down1' | 'down2'
export type Grade = 'S' | 'A' | 'B' | 'C'

export interface Question {
  id: string
  text: string
  type: 'scale' | 'text'
  competency?: string
}

export interface Cycle {
  id: string
  name: string
  period: string
  status: 'draft' | 'writing' | 'calibration' | 'closed'
  stages: Stage[]
  questions: Question[]
  targetIds: string[]
  dueDate: string
  finalGrades: Record<string, Grade>
}

export interface Answer {
  score?: number
  text?: string
}

export interface Review {
  id: string
  cycleId: string
  stage: Stage
  writerId: string
  targetId: string
  answers: Record<string, Answer>
  status: 'todo' | 'draft' | 'submitted'
}

export interface SurveyQuestion {
  id: string
  text: string
  category: string
  type: 'scale' | 'text'
}

export interface Survey {
  id: string
  title: string
  status: 'open' | 'closed'
  createdAt: string
  questions: SurveyQuestion[]
  responses: { userId: string; answers: Record<string, number | string> }[]
}

export interface Data {
  version: number
  company: string
  users: User[]
  teams: Team[]
  objectives: Objective[]
  meetings: Meeting[]
  feedback: Feedback[]
  cycles: Cycle[]
  reviews: Review[]
  surveys: Survey[]
}
