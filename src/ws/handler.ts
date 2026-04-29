import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { IncomingMessage } from 'http'
import { getAdapter } from '@/lib/store'
import type { StoredRoomState } from '@/lib/store/adapter'
import type { ClientMessage, ServerMessage } from '@/lib/types'
import {
  addParticipant,
  reconnectParticipant,
  castVote,
  reveal,
  reset,
  setStory,
  selectVerdict,
  toParticipantSnapshots,
} from '@/lib/roomFns'

const HEARTBEAT_INTERVAL_MS = 25_000

// Per-instance maps — never shared across processes
const roomConnections = new Map<string, Map<string, WebSocket>>()
const roomSubscriptions = new Map<string, () => void>()

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true })

  const alive = new Set<WebSocket>()
  const heartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (!alive.has(client)) {
        client.terminate()
        continue
      }
      alive.delete(client)
      client.ping()
    }
  }, HEARTBEAT_INTERVAL_MS)
  wss.on('close', () => clearInterval(heartbeatInterval))

  server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/ws')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    }
  })

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url!, `http://localhost`)
    const roomId = url.searchParams.get('roomId')
    const name = url.searchParams.get('name')?.trim()
    const role = url.searchParams.get('role') as 'voter' | 'spectator' | null
    const token = url.searchParams.get('token')

    if (!roomId || !name || !role || !token || !['voter', 'spectator'].includes(role)) {
      ws.close(1008, 'Missing required params')
      return
    }
    if (name.length > 64) {
      ws.close(1008, 'Name too long')
      return
    }

    const adapter = getAdapter()
    let state = await adapter.readRoom(roomId)
    if (!state) {
      ws.close(1008, 'Room not found')
      return
    }

    const existingParticipantId = state.tokens[token]
    const previousWs = existingParticipantId
      ? roomConnections.get(roomId)?.get(existingParticipantId) ?? null
      : null

    let participantId: string
    let isReconnect: boolean

    const reconnected = reconnectParticipant(state, token)
    if (reconnected) {
      state = reconnected
      participantId = existingParticipantId!
      isReconnect = true
    } else {
      const result = addParticipant(state, name, role, token)
      state = result.state
      participantId = result.id
      isReconnect = false
    }

    if (previousWs && previousWs !== ws) {
      previousWs.close(1000, 'replaced by reconnect')
    }

    await adapter.writeRoom(roomId, state)

    if (!roomConnections.has(roomId)) roomConnections.set(roomId, new Map())
    roomConnections.get(roomId)!.set(participantId, ws)

    if (!roomSubscriptions.has(roomId)) {
      const unsub = adapter.subscribe(roomId, (newState) => {
        broadcastToLocalClients(roomId, newState)
      })
      roomSubscriptions.set(roomId, unsub)
    }

    alive.add(ws)
    ws.on('pong', () => alive.add(ws))

    await adapter.publish(roomId, state)

    if (!isReconnect) {
      const participant = state.participants.find(p => p.id === participantId)!
      broadcastLocalMsgExcept(roomId, ws, {
        type: 'participant_joined',
        id: participant.id,
        name: participant.name,
        role: participant.role,
      })
    }

    ws.on('message', async (data) => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }

      const current = await adapter.readRoom(roomId)
      if (!current) return
      const participant = current.participants.find(p => p.id === participantId)
      if (!participant) return

      switch (msg.type) {
        case 'vote': {
          if (participant.role !== 'voter' || current.phase !== 'voting') break
          const next = castVote(current, participantId, msg.card)
          await adapter.writeRoom(roomId, next)
          broadcastLocalMsg(roomId, { type: 'vote_cast', participantId })
          await adapter.publish(roomId, next)
          break
        }
        case 'reveal': {
          if (current.hostOnlyReveal && !participant.isHost) return
          const next = reveal(current, participant.name)
          await adapter.writeRoom(roomId, next)
          broadcastLocalMsg(roomId, { type: 'votes_revealed', votes: next.votes })
          await adapter.publish(roomId, next)
          break
        }
        case 'reset': {
          if ((current.hostOnlyReveal && !participant.isHost) || current.phase !== 'revealed') break
          const next = reset(current, participant.name)
          await adapter.writeRoom(roomId, next)
          broadcastLocalMsg(roomId, { type: 'round_reset' })
          await adapter.publish(roomId, next)
          break
        }
        case 'set_story': {
          const next = setStory(current, msg.title)
          await adapter.writeRoom(roomId, next)
          await adapter.publish(roomId, next)
          break
        }
        case 'select_verdict': {
          if (current.phase !== 'revealed') break
          const next = selectVerdict(current, msg.card)
          await adapter.writeRoom(roomId, next)
          await adapter.publish(roomId, next)
          break
        }
      }
    })

    ws.on('close', () => {
      alive.delete(ws)
      const clients = roomConnections.get(roomId)
      if (clients) {
        clients.delete(participantId)
        if (clients.size === 0) {
          roomConnections.delete(roomId)
          const unsub = roomSubscriptions.get(roomId)
          if (unsub) {
            unsub()
            roomSubscriptions.delete(roomId)
          }
        }
      }
    })
  })
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

function broadcastToLocalClients(roomId: string, state: StoredRoomState): void {
  const clients = roomConnections.get(roomId)
  if (!clients) return
  for (const [pId, ws] of clients) send(ws, buildRoomState(state, pId))
}

function broadcastLocalMsg(roomId: string, msg: ServerMessage): void {
  const clients = roomConnections.get(roomId)
  if (!clients) return
  for (const [, ws] of clients) send(ws, msg)
}

function broadcastLocalMsgExcept(roomId: string, exclude: WebSocket, msg: ServerMessage): void {
  const clients = roomConnections.get(roomId)
  if (!clients) return
  for (const [, ws] of clients) {
    if (ws !== exclude) send(ws, msg)
  }
}

function buildRoomState(state: StoredRoomState, yourId: string): Extract<ServerMessage, { type: 'room_state' }> {
  return {
    type: 'room_state',
    phase: state.phase,
    deck: state.deck,
    customCards: state.customCards,
    currentStory: state.currentStory,
    participants: toParticipantSnapshots(state),
    votes: state.phase === 'revealed' ? state.votes : undefined,
    history: state.history,
    hostOnlyReveal: state.hostOnlyReveal,
    eventLog: state.eventLog,
    yourId,
    selectedVerdict: state.selectedVerdict,
  }
}
