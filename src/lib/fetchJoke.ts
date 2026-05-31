import type { Room } from './room'

export async function fetchJokeForRoom(room: Room): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch('https://teehee.dev/api/joke', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) return
    const data: unknown = await res.json()
    if (
      typeof data !== 'object' ||
      data === null ||
      typeof (data as Record<string, unknown>).question !== 'string' ||
      typeof (data as Record<string, unknown>).answer !== 'string'
    ) return
    room.joke = {
      question: (data as Record<string, unknown>).question as string,
      answer: (data as Record<string, unknown>).answer as string,
    }
  } catch {
    // swallow all errors — joke is optional
  } finally {
    clearTimeout(timeout)
  }
}
