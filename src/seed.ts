import type { Cycle, Data, Feedback, Meeting, Objective, Question, Review, Survey, User } from './types'
import { buildReviews } from './lib/cycle'
import { rng } from './lib/util'

export const DATA_VERSION = 2

const users: User[] = [
  { id: 'u_ceo', name: '정우진', title: '대표', teamId: 't_exec', role: 'leader', salary: 15000, hue: 210 },
  { id: 'u_hr', name: '박서윤', title: 'People 매니저', teamId: 't_exec', role: 'admin', managerId: 'u_ceo', salary: 7200, hue: 330 },
  { id: 'u_pl', name: '강지훈', title: 'Product 팀장', teamId: 't_prod', role: 'leader', managerId: 'u_ceo', salary: 9500, hue: 25 },
  { id: 'u_pm', name: '이하늘', title: 'Product Manager', teamId: 't_prod', role: 'member', managerId: 'u_pl', salary: 7800, hue: 160 },
  { id: 'u_ds', name: '최민준', title: 'Product Designer', teamId: 't_prod', role: 'member', managerId: 'u_pl', salary: 6900, hue: 270 },
  { id: 'u_fe', name: '윤서아', title: 'Frontend Engineer', teamId: 't_prod', role: 'member', managerId: 'u_pl', salary: 7400, hue: 95 },
  { id: 'u_gl', name: '한도윤', title: 'Growth 팀장', teamId: 't_grow', role: 'leader', managerId: 'u_ceo', salary: 9200, hue: 0 },
  { id: 'u_mk', name: '오지민', title: 'Growth Marketer', teamId: 't_grow', role: 'member', managerId: 'u_gl', salary: 6400, hue: 45 },
  { id: 'u_da', name: '서예린', title: 'Data Analyst', teamId: 't_grow', role: 'member', managerId: 'u_gl', salary: 7000, hue: 190 },
  { id: 'u_cs', name: '임태호', title: 'CX 매니저', teamId: 't_grow', role: 'member', managerId: 'u_gl', salary: 5800, hue: 130 },
]

const teams = [
  { id: 't_exec', name: '경영지원', leaderId: 'u_ceo' },
  { id: 't_prod', name: 'Product', leaderId: 'u_pl' },
  { id: 't_grow', name: 'Growth', leaderId: 'u_gl' },
]

const objectives: Objective[] = [
  {
    id: 'o_c1', title: '활성 고객사를 1,000곳으로 늘린다', level: 'company', ownerId: 'u_ceo', period: '2026 상반기', status: 'on',
    keyResults: [
      { id: 'k1', title: '유료 고객사 수', current: 820, target: 1000, unit: '곳' },
      { id: 'k2', title: '월 이탈률', current: 2.1, target: 1.5, unit: '%' },
    ],
    checkins: [{ id: 'c1', date: '2026-09-30', authorId: 'u_ceo', progress: 72, note: '3분기 신규 계약이 예상보다 빨랐다. 이탈률은 아직 목표와 거리가 있다.' }],
  },
  {
    id: 'o_t1', title: '신규 가입자의 온보딩 완료율을 높인다', level: 'team', ownerId: 'u_pl', parentId: 'o_c1', period: '2026 상반기', status: 'on',
    keyResults: [
      { id: 'k3', title: '온보딩 완료율', current: 58, target: 70, unit: '%' },
      { id: 'k4', title: '첫 주 활성 사용자 비율', current: 41, target: 50, unit: '%' },
    ],
    checkins: [{ id: 'c2', date: '2026-10-10', authorId: 'u_pl', progress: 70, note: '안내 문구 단순화 실험 결과 완료율이 6%p 올랐다.' }],
  },
  {
    id: 'o_p1', title: '온보딩 흐름을 3단계로 줄인다', level: 'personal', ownerId: 'u_pm', parentId: 'o_t1', period: '2026 상반기', status: 'on',
    keyResults: [{ id: 'k5', title: '온보딩 단계 수', current: 4, target: 3, unit: '단계' }],
    checkins: [
      { id: 'c3', date: '2026-09-12', authorId: 'u_pm', progress: 50, note: '사용자 인터뷰 8건으로 이탈 구간 2곳을 찾았다. 설정 진입 단계를 없애는 안을 제안했다.' },
      { id: 'c4', date: '2026-10-14', authorId: 'u_pm', progress: 80, note: 'A/B 테스트로 완료율 6%p 개선을 확인했고 전체 배포를 결정했다.' },
    ],
  },
  {
    id: 'o_p2', title: '온보딩 화면 디자인 시스템 정리', level: 'personal', ownerId: 'u_ds', parentId: 'o_t1', period: '2026 상반기', status: 'risk',
    keyResults: [{ id: 'k6', title: '컴포넌트 문서화', current: 12, target: 30, unit: '개' }],
    checkins: [{ id: 'c5', date: '2026-10-08', authorId: 'u_ds', progress: 40, note: '온보딩 시안 3안을 만들어 WAU 개선 방향을 구체화했다. 문서화는 일정이 밀렸다.' }],
  },
  {
    id: 'o_p3', title: '첫 화면 로딩 시간을 1초 이하로 만든다', level: 'personal', ownerId: 'u_fe', parentId: 'o_t1', period: '2026 상반기', status: 'done',
    keyResults: [{ id: 'k7', title: 'LCP', current: 0.9, target: 1, unit: '초' }],
    checkins: [{ id: 'c6', date: '2026-09-25', authorId: 'u_fe', progress: 100, note: '번들 분할과 이미지 지연 로딩으로 LCP를 2.4초에서 0.9초로 줄였다.' }],
  },
  {
    id: 'o_t2', title: '신규 유입을 늘린다', level: 'team', ownerId: 'u_gl', parentId: 'o_c1', period: '2026 상반기', status: 'risk',
    keyResults: [
      { id: 'k8', title: '월 신규 가입', current: 1300, target: 2000, unit: '건' },
      { id: 'k9', title: '유료 전환율', current: 7, target: 10, unit: '%' },
    ],
    checkins: [{ id: 'c7', date: '2026-10-05', authorId: 'u_gl', progress: 55, note: '검색 광고 효율이 떨어졌다. 콘텐츠 채널 비중을 늘리기로 했다.' }],
  },
  {
    id: 'o_p4', title: '콘텐츠 채널 유입 2배', level: 'personal', ownerId: 'u_mk', parentId: 'o_t2', period: '2026 상반기', status: 'on',
    keyResults: [{ id: 'k10', title: '콘텐츠 유입 세션', current: 14000, target: 20000, unit: '회' }],
    checkins: [{ id: 'c8', date: '2026-10-11', authorId: 'u_mk', progress: 70, note: '웨비나 2회 진행, 신청자 640명. 전환 추적을 서예린 님과 함께 붙였다.' }],
  },
  {
    id: 'o_p5', title: '퍼널 대시보드 구축', level: 'personal', ownerId: 'u_da', parentId: 'o_t2', period: '2026 상반기', status: 'done',
    keyResults: [{ id: 'k11', title: '자동화된 지표', current: 18, target: 15, unit: '개' }],
    checkins: [{ id: 'c9', date: '2026-09-20', authorId: 'u_da', progress: 100, note: '가입-전환 퍼널 18개 지표를 매일 자동 갱신하도록 만들었다.' }],
  },
  {
    id: 'o_p6', title: '문의 첫 응답 시간 30분 이내', level: 'personal', ownerId: 'u_cs', parentId: 'o_t2', period: '2026 상반기', status: 'risk',
    keyResults: [{ id: 'k12', title: '평균 첫 응답 시간', current: 48, target: 30, unit: '분' }],
    checkins: [{ id: 'c10', date: '2026-10-02', authorId: 'u_cs', progress: 35, note: '문의량이 40% 늘어 응답 시간이 길어졌다. 자주 묻는 질문 매크로 20개를 만들었다.' }],
  },
]

const meetings: Meeting[] = [
  {
    id: 'm1', leaderId: 'u_pl', memberId: 'u_pm', date: '2026-10-14',
    agenda: [
      { id: 'a1', text: '온보딩 A/B 테스트 결과 공유', done: true },
      { id: 'a2', text: '다음 분기 우선순위', done: true },
      { id: 'a3', text: '커리어 고민', done: false },
    ],
    notes: '온보딩 흐름을 검토한 결과 첫 화면의 안내 문구를 단순화하고 설정 진입 과정을 줄이기로 했다. 다음 배포 전 알림 설정 화면도 검증하기로 했다. 하늘 님은 데이터 근거로 의사결정을 이끈 점이 좋았다. 다만 가설과 확인된 사실을 구분해서 공유하면 논의가 더 빨라질 것 같다. 커리어는 다음 1:1에서 이어서 이야기하기로 했다.',
    actions: [
      { id: 'x1', text: '알림 설정 화면 사용성 검증', ownerId: 'u_pm', done: false },
      { id: 'x2', text: '로딩 및 빈 화면 상태 마무리 요청', ownerId: 'u_pl', done: true },
    ],
  },
  {
    id: 'm2', leaderId: 'u_pl', memberId: 'u_ds', date: '2026-10-08',
    agenda: [{ id: 'a4', text: '디자인 시스템 문서화 일정', done: true }],
    notes: '문서화가 밀린 이유는 온보딩 시안 작업이 우선이었기 때문이다. 시안 3안 덕분에 WAU 개선 방향이 빨리 정해졌다. 문서화는 11월 15일까지 20개를 목표로 다시 잡기로 했다.',
    actions: [{ id: 'x3', text: '컴포넌트 문서 20개 작성', ownerId: 'u_ds', done: false }],
  },
  {
    id: 'm3', leaderId: 'u_gl', memberId: 'u_cs', date: '2026-10-02',
    agenda: [{ id: 'a5', text: '문의량 증가 대응', done: true }],
    notes: '문의량이 40% 늘어 응답 시간이 목표보다 길다. 매크로 20개로 일부 해소했지만 인력 보강이 필요하다. 채용 요청서를 검토하기로 했다. 태호 님이 힘든 상황에서도 고객 만족도를 유지한 점이 인상적이었다.',
    actions: [{ id: 'x4', text: 'CX 채용 요청서 작성', ownerId: 'u_gl', done: false }],
  },
  {
    id: 'm4', leaderId: 'u_pl', memberId: 'u_pm', date: '2026-10-28',
    agenda: [{ id: 'a6', text: '커리어 고민 이어서', done: false }, { id: 'a7', text: '상반기 셀프 리뷰 준비', done: false }],
    notes: '',
    actions: [],
  },
]

const feedback: Feedback[] = [
  { id: 'f1', fromId: 'u_fe', toId: 'u_pm', kind: 'praise', value: '데이터로 말하기', visibility: 'public', date: '2026-10-15', text: '온보딩 실험을 설계할 때 지표와 가설을 먼저 문서로 정리해 줘서 개발 범위를 빨리 정할 수 있었어요. 결과도 숫자로 바로 공유해 줘서 좋았습니다.' },
  { id: 'f2', fromId: 'u_ds', toId: 'u_pm', kind: 'advice', value: '함께 성장하기', visibility: 'private', date: '2026-10-09', text: '회의에서 결론이 빨리 나는 건 좋은데, 가끔 디자인 대안을 검토할 시간이 부족했어요. 결정 전에 하루 정도 리뷰 시간을 주면 좋겠습니다.' },
  { id: 'f3', fromId: 'u_pm', toId: 'u_ds', kind: 'praise', value: '고객 중심', visibility: 'public', date: '2026-10-08', text: '문제의 원인을 빠르게 파악하고 여러 디자인 대안을 제안해 주셔서 WAU 개선 방향을 빠르게 구체화할 수 있었습니다.' },
  { id: 'f4', fromId: 'u_pm', toId: 'u_fe', kind: 'praise', value: '끝까지 책임지기', visibility: 'public', date: '2026-09-26', text: 'LCP를 0.9초까지 줄인 작업 정말 대단했어요. 진행 상황을 매일 공유해 줘서 협업이 수월했습니다.' },
  { id: 'f5', fromId: 'u_da', toId: 'u_mk', kind: 'praise', value: '데이터로 말하기', visibility: 'public', date: '2026-10-12', text: '웨비나 전환 추적을 처음부터 같이 설계해서 신청자 640명의 이후 행동까지 볼 수 있었어요.' },
  { id: 'f6', fromId: 'u_mk', toId: 'u_cs', kind: 'praise', value: '고객 중심', visibility: 'public', date: '2026-10-03', text: '문의가 몰린 주에도 고객 응대 품질을 유지해 주셔서 웨비나 후속 문의가 잘 처리됐어요.' },
  { id: 'f7', fromId: 'u_gl', toId: 'u_mk', kind: 'advice', value: '함께 성장하기', visibility: 'private', date: '2026-09-20', text: '캠페인 결과 공유가 늦어질 때가 있어요. 중간 결과라도 주 1회 공유해 주면 예산 조정이 빨라집니다.' },
  { id: 'f8', fromId: 'u_cs', toId: 'u_da', kind: 'praise', value: '끝까지 책임지기', visibility: 'public', date: '2026-09-22', text: '퍼널 대시보드 덕분에 문의 유형과 이탈의 관계를 직접 볼 수 있게 됐어요.' },
]

const scaleQ = (id: string, competency: string, text: string): Question => ({ id, type: 'scale', competency, text })
const questions: Question[] = [
  scaleQ('q_ps', '문제해결', '문제의 원인을 파악하고 근거를 바탕으로 해결책을 찾았나요?'),
  scaleQ('q_co', '협업', '동료와 정보를 투명하게 나누고 함께 성과를 냈나요?'),
  scaleQ('q_ex', '실행력', '목표를 끝까지 책임지고 실행했나요?'),
  scaleQ('q_gr', '성장', '새로운 역량을 배우고 업무에 적용했나요?'),
  { id: 'q_t1', type: 'text', text: '이번 기간의 주요 성과를 구체적인 사례와 함께 적어 주세요.' },
  { id: 'q_t2', type: 'text', text: '앞으로 더 성장하기 위해 보완하면 좋을 점은 무엇인가요?' },
]

const memberIds = users.filter((u) => u.id !== 'u_ceo').map((u) => u.id)

const pastCycle: Cycle = {
  id: 'cy_2025h2', name: '2025 하반기 성과 리뷰', period: '2025-07 ~ 2025-12', status: 'closed',
  stages: ['self', 'peer', 'down1', 'down2'], questions, targetIds: memberIds, dueDate: '2026-01-20', finalGrades: {},
}
const currentCycle: Cycle = {
  id: 'cy_2026h1', name: '2026 상반기 성과 리뷰', period: '2026-01 ~ 2026-06', status: 'writing',
  stages: ['self', 'peer', 'down1', 'down2'], questions, targetIds: memberIds, dueDate: '2026-11-07', finalGrades: {},
}

// 구성원별 성향: [실제 역량, 자기평가 편향]
const profile: Record<string, [number, number]> = {
  u_hr: [3.8, 0], u_pl: [4.1, -0.2], u_pm: [4.3, -0.3], u_ds: [3.9, 0.2], u_fe: [4.5, -0.4],
  u_gl: [3.6, 0.6], u_mk: [3.4, 0.9], u_da: [4.2, -0.1], u_cs: [3.3, 0.1],
}
const compBias: Record<string, number> = { q_ps: 0.1, q_co: 0.2, q_ex: 0, q_gr: -0.3 }

const praise = [
  '맡은 업무를 높은 품질로 책임감 있게 수행했고, 진행 상황을 투명하게 공유해 협업이 수월했습니다.',
  '목표 대비 성과를 숫자로 정리해 공유했고, 팀의 우선순위를 정하는 데 큰 도움이 되었습니다.',
  '어려운 상황에서도 고객과 동료의 입장을 먼저 생각하며 문제를 풀었습니다.',
]
const advice = [
  '결론을 낼 때 근거가 되는 데이터나 사례를 함께 제시하면 설득력이 더 높아질 것 같습니다.',
  '일정이 밀릴 때 조금 더 일찍 공유해 주면 팀이 함께 대응할 수 있을 것 같습니다.',
  '새로운 도구나 방법을 시도해 보는 데 조금 더 시간을 써 보면 좋겠습니다.',
]

function fillReviews(reviews: Review[], seed: number, submitRate: number): Review[] {
  const r = rng(seed)
  return reviews.map((rv) => {
    if (r() > submitRate) return rv
    const [base, bias] = profile[rv.targetId] ?? [3.5, 0]
    const answers: Review['answers'] = {}
    for (const q of questions) {
      if (q.type === 'scale') {
        const s = base + (compBias[q.id] ?? 0) + (rv.stage === 'self' ? bias : 0) + (r() - 0.5) * 0.9
        answers[q.id] = { score: Math.max(1, Math.min(5, Math.round(s))) }
      } else {
        const pool = q.id === 'q_t1' ? praise : advice
        answers[q.id] = { text: pool[Math.floor(r() * pool.length)] }
      }
    }
    return { ...rv, answers, status: 'submitted' }
  })
}

const pastReviews = fillReviews(buildReviews(pastCycle, users), 7, 1.1)
pastCycle.finalGrades = { u_hr: 'B', u_pl: 'A', u_pm: 'A', u_ds: 'B', u_fe: 'S', u_gl: 'B', u_mk: 'B', u_da: 'A', u_cs: 'C' }

// 현재 사이클: 이하늘(u_pm)의 셀프 리뷰는 데모를 위해 비워 둔다
const currentReviews = fillReviews(buildReviews(currentCycle, users), 42, 0.55).map((rv) =>
  rv.writerId === 'u_pm' || rv.writerId === 'u_pl' ? { ...rv, answers: {}, status: 'todo' as const } : rv,
)

const survey: Survey = {
  id: 's1', title: '10월 팀 컨디션 서베이', status: 'open', createdAt: '2026-10-20',
  questions: [
    { id: 'sq1', category: '몰입', type: 'scale', text: '요즘 나의 업무에 의미를 느낀다.' },
    { id: 'sq2', category: '몰입', type: 'scale', text: '업무에 몰입할 수 있는 환경이 갖춰져 있다.' },
    { id: 'sq3', category: '리더십', type: 'scale', text: '리더가 나의 성장에 관심을 가진다.' },
    { id: 'sq4', category: '협업', type: 'scale', text: '다른 팀과의 협업이 원활하다.' },
    { id: 'sq5', category: '업무량', type: 'scale', text: '업무량이 적절하다.' },
    { id: 'sq6', category: '의견', type: 'text', text: '회사나 팀에 하고 싶은 이야기를 자유롭게 적어 주세요.' },
  ],
  responses: [
    { userId: 'u_fe', answers: { sq1: 5, sq2: 4, sq3: 5, sq4: 4, sq5: 3, sq6: '성능 개선 작업이 인정받아서 만족스럽습니다. 다만 배포 일정이 촉박할 때가 있어요.' } },
    { userId: 'u_ds', answers: { sq1: 4, sq2: 3, sq3: 4, sq4: 3, sq5: 2, sq6: '시안 작업과 문서화가 겹쳐 업무량이 많아 힘듭니다. 우선순위 조정이 필요해요.' } },
    { userId: 'u_mk', answers: { sq1: 4, sq2: 4, sq3: 3, sq4: 5, sq5: 3, sq6: '데이터팀과 협업이 좋아졌어요. 감사합니다.' } },
    { userId: 'u_da', answers: { sq1: 5, sq2: 5, sq3: 4, sq4: 4, sq5: 4, sq6: '대시보드가 실제로 쓰이는 걸 보니 보람 있어요.' } },
    { userId: 'u_cs', answers: { sq1: 3, sq2: 2, sq3: 4, sq4: 3, sq5: 1, sq6: '문의량이 너무 많아 지치고 부족한 인력이 걱정됩니다.' } },
    { userId: 'u_hr', answers: { sq1: 4, sq2: 4, sq3: 4, sq4: 4, sq5: 3, sq6: '' } },
  ],
}

export function makeSeed(): Data {
  return {
    version: DATA_VERSION,
    company: '주식회사 펄스데모',
    users,
    teams,
    objectives,
    meetings,
    feedback: feedback satisfies Feedback[],
    cycles: [currentCycle, pastCycle],
    reviews: [...currentReviews, ...pastReviews],
    surveys: [survey],
  }
}
