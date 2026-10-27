import { useStore } from '../store'
import { Card, PageHead, Person } from '../ui'

export default function People() {
  const { data, user } = useStore()
  return (
    <>
      <PageHead kicker={data.company} title={`구성원 ${data.users.length}명`} />
      <div className="grid-3">
        {data.teams.map((t) => {
          const members = data.users.filter((u) => u.teamId === t.id && u.id !== t.leaderId)
          return (
            <Card key={t.id} title={t.name}>
              <div className="leader-row">
                <Person user={user(t.leaderId)} sub={`${user(t.leaderId)?.title} · 리더`} />
              </div>
              <ul className="list org">
                {members.map((u) => (
                  <li key={u.id}>
                    <Person user={u} />
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>
    </>
  )
}
