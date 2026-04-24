import { describe, it, expect } from 'vitest'
import { Room } from '../lib/room'
import type { WebSocket } from 'ws'

const mockWs = () => ({}) as WebSocket

describe('Room', () => {
  it('creates a room with a generated id and voting phase', () => {
    const room = new Room('fibonacci')
    expect(room.id).toBeTruthy()
    expect(room.deck).toBe('fibonacci')
    expect(room.phase).toBe('voting')
    expect(room.history).toEqual([])
  })

  describe('addParticipant', () => {
    it('first voter becomes host', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      expect(p.isHost).toBe(true)
    })

    it('second voter is not host', () => {
      const room = new Room('fibonacci')
      room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      const p2 = room.addParticipant('Bob', 'voter', mockWs(), 'tok-bob')
      expect(p2.isHost).toBe(false)
    })

    it('spectator is never host even when first to join', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Dave', 'spectator', mockWs(), 'tok-dave')
      expect(p.isHost).toBe(false)
    })

    it('voter becomes host when spectator joined first', () => {
      const room = new Room('fibonacci')
      room.addParticipant('Dave', 'spectator', mockWs(), 'tok-dave')
      const voter = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      expect(voter.isHost).toBe(true)
    })

    it('stores participant in participants map', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      expect(room.participants.get(p.id)).toBe(p)
    })
  })

  describe('addParticipant (token)', () => {
    it('stores token in the tokens map', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      expect(room.tokens.get('tok-1')).toBe(p.id)
    })
  })

  describe('reconnectParticipant', () => {
    it('returns null for an unknown token', () => {
      const room = new Room('fibonacci')
      expect(room.reconnectParticipant('unknown', mockWs())).toBeNull()
    })

    it('updates the ws reference and returns the participant', () => {
      const room = new Room('fibonacci')
      const ws2 = mockWs()
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      const restored = room.reconnectParticipant('tok-1', ws2)
      expect(restored).toBe(p)
      expect(p.ws).toBe(ws2)
    })

    it('preserves vote on reconnect', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      room.castVote(p.id, 5)
      room.reconnectParticipant('tok-1', mockWs())
      expect(room.votes.get(p.id)).toBe(5)
    })

    it('preserves host status on reconnect', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      expect(p.isHost).toBe(true)
      room.reconnectParticipant('tok-1', mockWs())
      expect(p.isHost).toBe(true)
    })
  })

  describe('removeParticipant', () => {
    it('removes participant and their vote', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      room.castVote(p.id, 5)
      room.removeParticipant(p.id)
      expect(room.participants.has(p.id)).toBe(false)
      expect(room.votes.has(p.id)).toBe(false)
    })

    it('promotes next voter when host leaves', () => {
      const room = new Room('fibonacci')
      const host = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      const bob = room.addParticipant('Bob', 'voter', mockWs(), 'tok-bob')
      room.removeParticipant(host.id)
      expect(bob.isHost).toBe(true)
    })

    it('does not crash when last participant leaves', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      expect(() => room.removeParticipant(p.id)).not.toThrow()
    })
  })

  describe('castVote', () => {
    it('records vote for voter in voting phase', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      room.castVote(p.id, 5)
      expect(room.votes.get(p.id)).toBe(5)
    })

    it('ignores vote from spectator', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Dave', 'spectator', mockWs(), 'tok-dave')
      room.castVote(p.id, 5)
      expect(room.votes.has(p.id)).toBe(false)
    })

    it('ignores vote when phase is revealed', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      room.reveal('Alice')
      room.castVote(p.id, 5)
      expect(room.votes.has(p.id)).toBe(false)
    })

    it('allows changing vote during voting phase', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      room.castVote(p.id, 3)
      room.castVote(p.id, 5)
      expect(room.votes.get(p.id)).toBe(5)
    })
  })

  describe('reveal', () => {
    it('sets phase to revealed', () => {
      const room = new Room('fibonacci')
      room.reveal('Alice')
      expect(room.phase).toBe('revealed')
    })
  })

  describe('reset', () => {
    it('is a no-op when phase is voting', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      room.castVote(p.id, 5)
      room.reset('Alice') // called without reveal — should be ignored
      expect(room.history).toHaveLength(0)
      expect(room.votes.get(p.id)).toBe(5)
      expect(room.phase).toBe('voting')
    })

    it('saves round to history with votes and resets state', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      room.setStory('Story 1')
      room.castVote(p.id, 5)
      room.reveal('Alice')
      room.reset('Alice')
      expect(room.history).toHaveLength(1)
      expect(room.history[0].story).toBe('Story 1')
      expect(room.history[0].votes[p.id]).toBe(5)
      expect(room.votes.size).toBe(0)
      expect(room.phase).toBe('voting')
      expect(room.currentStory).toBeUndefined()
    })

    it('sets consensus when all voters vote the same', () => {
      const room = new Room('fibonacci')
      const p1 = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      const p2 = room.addParticipant('Bob', 'voter', mockWs(), 'tok-2')
      room.castVote(p1.id, 5)
      room.castVote(p2.id, 5)
      room.reveal('Alice')
      room.reset('Alice')
      expect(room.history[0].consensus).toBe(5)
    })

    it('consensus is undefined when voters disagree', () => {
      const room = new Room('fibonacci')
      const p1 = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      const p2 = room.addParticipant('Bob', 'voter', mockWs(), 'tok-2')
      room.castVote(p1.id, 3)
      room.castVote(p2.id, 5)
      room.reveal('Alice')
      room.reset('Alice')
      expect(room.history[0].consensus).toBeUndefined()
    })

    it('consensus is undefined when not all voters voted', () => {
      const room = new Room('fibonacci')
      const p1 = room.addParticipant('Alice', 'voter', mockWs(), 'tok-1')
      room.addParticipant('Bob', 'voter', mockWs(), 'tok-2')
      room.castVote(p1.id, 5)
      room.reveal('Alice')
      room.reset('Alice')
      expect(room.history[0].consensus).toBeUndefined()
    })
  })

  describe('toParticipantSnapshots', () => {
    it('marks hasVoted true for voters who voted', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      room.castVote(p.id, 5)
      const snapshots = room.toParticipantSnapshots()
      expect(snapshots.find(s => s.id === p.id)?.hasVoted).toBe(true)
    })

    it('marks hasVoted false for voters who did not vote', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Alice', 'voter', mockWs(), 'tok-alice')
      const snapshots = room.toParticipantSnapshots()
      expect(snapshots.find(s => s.id === p.id)?.hasVoted).toBe(false)
    })

    it('marks hasVoted false for spectators', () => {
      const room = new Room('fibonacci')
      const p = room.addParticipant('Dave', 'spectator', mockWs(), 'tok-dave')
      const snapshots = room.toParticipantSnapshots()
      expect(snapshots.find(s => s.id === p.id)?.hasVoted).toBe(false)
    })
  })

  describe('eventLog', () => {
    it('logs reveal event', () => {
      const room = new Room('fibonacci')
      room.reveal('Alice')
      expect(room.eventLog).toHaveLength(1)
      expect(room.eventLog[0]).toMatchObject({
        type: 'revealed',
        actorName: 'Alice',
      })
      expect(room.eventLog[0].timestamp).toBeLessThanOrEqual(Date.now())
    })

    it('logs reset event', () => {
      const room = new Room('fibonacci')
      room.reveal('Alice')
      room.reset('Bob')
      expect(room.eventLog).toHaveLength(2)
      expect(room.eventLog[1]).toMatchObject({
        type: 'reset',
        actorName: 'Bob',
      })
    })
  })
})
