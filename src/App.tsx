import { useStore } from './store'
import { Avatar, Link, useRoute } from './ui'
import { cx } from './lib/util'
import Home from './pages/Home'
import Goals from './pages/Goals'
import OneOnOnes from './pages/OneOnOnes'
import FeedbackPage from './pages/Feedback'
import Reviews from './pages/Reviews'
import ReviewWrite from './pages/ReviewWrite'
import CycleAdmin from './pages/CycleAdmin'
import Calibration from './pages/Calibration'
import Surveys from './pages/Surveys'
import People from './pages/People'
import Profile from './pages/Profile'

const NAV: [string, string][] = [
  ['home', '오늘'],
  ['goals', '목표'],
  ['1on1', '1:1'],
  ['feedback', '피드백'],
  ['reviews', '리뷰'],
  ['calibration', '캘리브레이션'],
  ['surveys', '서베이'],
  ['people', '구성원'],
]

export default function App() {
  const { data, me, setMe, reset } = useStore()
  const [page, ...rest] = useRoute()
  const nav = NAV.filter(([k]) => k !== 'calibration' || me.role !== 'member')

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-in">
          <Link to="home" className="brand">
            <span className="brand-mark" aria-hidden />
            Pulse
          </Link>
          <nav className="nav" aria-label="주 메뉴">
            {nav.map(([k, l]) => (
              <Link key={k} to={k} className={cx('nav-item', page === k && 'on')}>
                {l}
              </Link>
            ))}
          </nav>
          <label className="me">
            <Avatar user={me} size={26} />
            <select value={me.id} onChange={(e) => setMe(e.target.value)} aria-label="사용자 전환">
              {data.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role === 'admin' ? 'HR 관리자' : u.role === 'leader' ? '리더' : '구성원'}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main className="main">
        <Route page={page} rest={rest} />
      </main>
      <footer className="foot">
        <span>
          {data.company} · 데모 데이터는 이 브라우저에만 저장됩니다
        </span>
        <button
          className="btn ghost small"
          onClick={() => {
            if (confirm('모든 데이터를 처음 상태로 되돌릴까요?')) reset()
          }}
        >
          데모 데이터 초기화
        </button>
      </footer>
    </div>
  )
}

function Route({ page, rest }: { page: string; rest: string[] }) {
  switch (page) {
    case 'goals':
      return <Goals />
    case '1on1':
      return <OneOnOnes id={rest[0]} />
    case 'feedback':
      return <FeedbackPage />
    case 'reviews':
      if (rest[0] === 'write' && rest[1]) return <ReviewWrite id={rest[1]} />
      if (rest[0] === 'cycle') return <CycleAdmin id={rest[1]} />
      return <Reviews />
    case 'calibration':
      return <Calibration cycleId={rest[0]} />
    case 'surveys':
      return <Surveys id={rest[0]} />
    case 'people':
      return rest[0] ? <Profile id={rest[0]} /> : <People />
    default:
      return <Home />
  }
}
