// 브라우저와 서버(/api/ai)가 함께 쓰는 요청·응답 형태

export interface EvidenceCandidate {
  id: string
  source: '목표' | '체크인' | '피드백' | '1:1'
  date: string
  title: string
  text: string
}

export interface AiEvidencePick {
  id: string
  reason: string
}

export interface CoachTip {
  ok: boolean
  label: string
  hint: string
}

export interface AiCoachResult {
  score: number
  tips: CoachTip[]
  suggestion: string
}

export interface AiSummary {
  summary: string[]
  actions: { text: string; owner: 'leader' | 'member' }[]
}
