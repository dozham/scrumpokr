import { describe, it, expect } from 'vitest'
import {
  createRoom,
  addParticipant,
  reconnectParticipant,
  removeParticipant,
  castVote,
  reveal,
  selectVerdict,
  reset,
  setStory,
  toParticipantSnapshots,
} from '../lib/roomFns'
import type { StoredRoomState } from '../lib/store/adapter'

function makeRoom(): StoredRoomState {
  return createRoom('test-room', 'fibonacci', undefined, false, 1000)
}

describe('createRoom', () => {
  it('creates a room with given id and voting phase', () => {
    const state = makeRoom()
    expect(state.id).toBe('test-room')
    expect(state.deck).toBe('fibonacci')
    expect(state.phase).toBe('voting')
    expect(state.history).toEqual([])
    expect(state.participants).toEqual([])
  })
})

describe('addParticipant', () => {
  it('first voter becomes host', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const p = s1.participants.find(p => p.id === id)!
    expect(p.isHost).toBe(true)
  })

  it('second voter is not host', () => {
    const state = makeRoom()
    const { state: s1 } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const { state: s2, id: bobId } = addParticipant(s1, 'Bob', 'voter', 'tok-bob')
    const bob = s2.participants.find(p => p.id === bobId)!
    expect(bob.isHost).toBe(false)
  })

  it('spectator is never host even when first to join', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Dave', 'spectator', 'tok-dave')
    const p = s1.participants.find(p => p.id === id)!
    expect(p.isHost).toBe(false)
  })

  it('voter becomes host when spectator joined first', () => {
    const state = makeRoom()
    const { state: s1 } = addParticipant(state, 'Dave', 'spectator', 'tok-dave')
    const { state: s2, id: aliceId } = addParticipant(s1, 'Alice', 'voter', 'tok-alice')
    const alice = s2.participants.find(p => p.id === aliceId)!
    expect(alice.isHost).toBe(true)
  })

  it('stores token in tokens map', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    expect(s1.tokens['tok-1']).toBe(id)
  })
})

describe('reconnectParticipant', () => {
  it('returns null for an unknown token', () => {
    const state = makeRoom()
    expect(reconnectParticipant(state, 'unknown')).toBeNull()
  })

  it('returns updated state for a known token', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const result = reconnectParticipant(s1, 'tok-1')
    expect(result).not.toBeNull()
    expect(result!.tokens['tok-1']).toBe(id)
  })

  it('preserves vote on reconnect', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const s2 = castVote(s1, id, 5)
    const s3 = reconnectParticipant(s2, 'tok-1')!
    expect(s3.votes[id]).toBe(5)
  })

  it('preserves host status on reconnect', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const s2 = reconnectParticipant(s1, 'tok-1')!
    const p = s2.participants.find(p => p.id === id)!
    expect(p.isHost).toBe(true)
  })
})

describe('removeParticipant', () => {
  it('removes participant and their vote', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = castVote(s1, id, 5)
    const s3 = removeParticipant(s2, id)
    expect(s3.participants.some(p => p.id === id)).toBe(false)
    expect(s3.votes[id]).toBeUndefined()
  })

  it('promotes next voter when host leaves', () => {
    const state = makeRoom()
    const { state: s1, id: hostId } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const { state: s2, id: bobId } = addParticipant(s1, 'Bob', 'voter', 'tok-bob')
    const s3 = removeParticipant(s2, hostId)
    const bob = s3.participants.find(p => p.id === bobId)!
    expect(bob.isHost).toBe(true)
  })

  it('does not crash when last participant leaves', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    expect(() => removeParticipant(s1, id)).not.toThrow()
  })
})

describe('castVote', () => {
  it('records vote for voter in voting phase', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = castVote(s1, id, 5)
    expect(s2.votes[id]).toBe(5)
  })

  it('ignores vote from spectator', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Dave', 'spectator', 'tok-dave')
    const s2 = castVote(s1, id, 5)
    expect(s2.votes[id]).toBeUndefined()
  })

  it('ignores vote when phase is revealed', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = reveal(s1, 'Alice')
    const s3 = castVote(s2, id, 5)
    expect(s3.votes[id]).toBeUndefined()
  })

  it('allows changing vote during voting phase', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = castVote(s1, id, 3)
    const s3 = castVote(s2, id, 5)
    expect(s3.votes[id]).toBe(5)
  })
})

describe('reveal', () => {
  it('sets phase to revealed', () => {
    const state = makeRoom()
    const s1 = reveal(state, 'Alice')
    expect(s1.phase).toBe('revealed')
  })

  it('logs reveal event', () => {
    const state = makeRoom()
    const s1 = reveal(state, 'Alice')
    expect(s1.eventLog).toHaveLength(1)
    expect(s1.eventLog[0]).toMatchObject({ type: 'revealed', actorName: 'Alice' })
  })
})

describe('reset', () => {
  it('is a no-op when phase is voting', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = castVote(s1, id, 5)
    const s3 = reset(s2, 'Alice')
    expect(s3.history).toHaveLength(0)
    expect(s3.votes[id]).toBe(5)
    expect(s3.phase).toBe('voting')
  })

  it('saves round to history with votes and resets state', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    let s = setStory(s1, 'Story 1')
    s = castVote(s, id, 5)
    s = reveal(s, 'Alice')
    const s2 = reset(s, 'Alice')
    expect(s2.history).toHaveLength(1)
    expect(s2.history[0].story).toBe('Story 1')
    expect(s2.history[0].votes[id]).toBe(5)
    expect(s2.votes).toEqual({})
    expect(s2.phase).toBe('voting')
    expect(s2.currentStory).toBeUndefined()
  })

  it('sets consensus when all voters vote the same', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 5)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].consensus).toBe(5)
  })

  it('consensus is undefined when voters disagree', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 3)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].consensus).toBeUndefined()
  })

  it('logs reset event', () => {
    const state = makeRoom()
    let s = reveal(state, 'Alice')
    s = reset(s, 'Bob')
    expect(s.eventLog).toHaveLength(2)
    expect(s.eventLog[1]).toMatchObject({ type: 'reset', actorName: 'Bob' })
  })

  it('records verdictSource natural when all voters agree', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 5)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].verdictSource).toBe('natural')
    expect(s3.history[0].consensus).toBe(5)
  })

  it('records verdictSource selected when selectedVerdict is a Card and no natural consensus', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 3)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    s = selectVerdict(s, 5)
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].verdictSource).toBe('selected')
    expect(s3.history[0].consensus).toBe(5)
  })

  it('records verdictSource none when selectedVerdict is NO_CONSENSUS', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 3)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    s = selectVerdict(s, 'NO_CONSENSUS')
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].verdictSource).toBe('none')
    expect(s3.history[0].consensus).toBeUndefined()
  })

  it('records verdictSource none when no selectedVerdict and voters disagree', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 3)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].verdictSource).toBe('none')
    expect(s3.history[0].consensus).toBeUndefined()
  })

  it('clears selectedVerdict after reset', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    let s = castVote(s1, id, 5)
    s = reveal(s, 'Alice')
    s = selectVerdict(s, 5)
    const s2 = reset(s, 'Alice')
    expect(s2.selectedVerdict).toBeUndefined()
  })

  it('natural consensus takes precedence over selectedVerdict', () => {
    const state = makeRoom()
    const { state: s1, id: id1 } = addParticipant(state, 'Alice', 'voter', 'tok-1')
    const { state: s2, id: id2 } = addParticipant(s1, 'Bob', 'voter', 'tok-2')
    let s = castVote(s2, id1, 5)
    s = castVote(s, id2, 5)
    s = reveal(s, 'Alice')
    s = selectVerdict(s, 3)
    const s3 = reset(s, 'Alice')
    expect(s3.history[0].verdictSource).toBe('natural')
    expect(s3.history[0].consensus).toBe(5)
  })
})

describe('selectVerdict', () => {
  it('stores a card verdict', () => {
    const state = makeRoom()
    const s1 = selectVerdict(state, 5)
    expect(s1.selectedVerdict).toBe(5)
  })

  it('stores NO_CONSENSUS', () => {
    const state = makeRoom()
    const s1 = selectVerdict(state, 'NO_CONSENSUS')
    expect(s1.selectedVerdict).toBe('NO_CONSENSUS')
  })

  it('can be overwritten', () => {
    const state = makeRoom()
    const s1 = selectVerdict(state, 3)
    const s2 = selectVerdict(s1, 8)
    expect(s2.selectedVerdict).toBe(8)
  })
})

describe('toParticipantSnapshots', () => {
  it('marks hasVoted true for voters who voted', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const s2 = castVote(s1, id, 5)
    const snapshots = toParticipantSnapshots(s2)
    expect(snapshots.find(s => s.id === id)?.hasVoted).toBe(true)
  })

  it('marks hasVoted false for voters who did not vote', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Alice', 'voter', 'tok-alice')
    const snapshots = toParticipantSnapshots(s1)
    expect(snapshots.find(s => s.id === id)?.hasVoted).toBe(false)
  })

  it('marks hasVoted false for spectators', () => {
    const state = makeRoom()
    const { state: s1, id } = addParticipant(state, 'Dave', 'spectator', 'tok-dave')
    const snapshots = toParticipantSnapshots(s1)
    expect(snapshots.find(s => s.id === id)?.hasVoted).toBe(false)
  })
})
