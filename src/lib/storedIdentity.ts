import { nanoid } from 'nanoid'

export interface StoredIdentity {
  name: string
  role: 'voter' | 'spectator'
}

export function getStoredIdentity(roomId: string): StoredIdentity | null {
  const name = localStorage.getItem(`name-${roomId}`)
  const role = localStorage.getItem(`role-${roomId}`) as 'voter' | 'spectator' | null
  if (!name || !role) return null
  return { name, role }
}

export function setStoredIdentity(roomId: string, name: string, role: 'voter' | 'spectator'): void {
  localStorage.setItem(`name-${roomId}`, name)
  localStorage.setItem(`role-${roomId}`, role)
}

export function clearStoredIdentity(roomId: string): void {
  localStorage.removeItem(`name-${roomId}`)
  localStorage.removeItem(`role-${roomId}`)
  localStorage.removeItem(`token-${roomId}`)
}

export function getOrCreateParticipantToken(roomId: string): string {
  const existing = localStorage.getItem(`token-${roomId}`)
  if (existing) return existing
  const token = nanoid(16)
  localStorage.setItem(`token-${roomId}`, token)
  return token
}
