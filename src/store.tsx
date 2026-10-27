import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Data, User } from './types'
import { DATA_VERSION, makeSeed } from './seed'

const KEY = 'pulse-review:data'
const ME_KEY = 'pulse-review:me'

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw) as Data
      if (d.version === DATA_VERSION) return d
    }
  } catch {
    // 저장소를 못 쓰면 시드로 시작
  }
  return structuredClone(makeSeed())
}

interface Store {
  data: Data
  me: User
  setMe: (id: string) => void
  /** draft를 직접 고치는 방식으로 상태를 갱신한다 */
  update: (fn: (draft: Data) => void) => void
  reset: () => void
  user: (id: string | undefined) => User | undefined
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(load)
  const [meId, setMeId] = useState<string>(() => {
    try {
      return localStorage.getItem(ME_KEY) ?? 'u_pm'
    } catch {
      return 'u_pm'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // 무시
    }
  }, [data])

  const update = useCallback((fn: (d: Data) => void) => {
    setData((prev) => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  }, [])

  const store = useMemo<Store>(() => {
    const byId = new Map(data.users.map((u) => [u.id, u]))
    return {
      data,
      me: byId.get(meId) ?? data.users[0],
      setMe: (id) => {
        setMeId(id)
        try {
          localStorage.setItem(ME_KEY, id)
        } catch {
          // 무시
        }
      },
      update,
      reset: () => setData(structuredClone(makeSeed())),
      user: (id) => (id ? byId.get(id) : undefined),
    }
  }, [data, meId, update])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}

/** 내가 리더로서 볼 수 있는 구성원 (직속 + 그 아래) */
export function reportsOf(data: Data, leaderId: string): User[] {
  const out: User[] = []
  const walk = (id: string) => {
    for (const u of data.users.filter((x) => x.managerId === id)) {
      out.push(u)
      walk(u.id)
    }
  }
  walk(leaderId)
  return out
}
