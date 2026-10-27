let counter = 0
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export const today = () => new Date().toISOString().slice(0, 10)

export function fmtDate(d: string): string {
  const [y, m, day] = d.split('-')
  return `${y}.${m}.${day}`
}

export function daysFrom(d: string): number {
  return Math.round((new Date(d).getTime() - new Date(today()).getTime()) / 86400000)
}

export function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ')
}

/** 시드 데이터용 결정적 난수 */
export function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
