import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { IncomingMessage } from 'http'
import { getRoom } from '@/lib/registry'
import type { ClientMessage, ServerMessage } from '@/lib/types'
import type { Room } from '@/lib/room'

const HEARTBEAT_INTERVAL_MS = 25_000

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

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
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

    const room = getRoom(roomId)
    if (!room) {
      ws.close(1008, 'Room not found')
      return
    }

    const existingId = room.tokens.get(token)
    const previousWs = existingId ? room.participants.get(existingId)?.ws ?? null : null

    const reconnected = room.reconnectParticipant(token, ws)
    const participant = reconnected ?? room.addParticipant(name, role, ws, token)

    if (previousWs && previousWs !== ws) {
      previousWs.close(1000, 'replaced by reconnect')
    }

    alive.add(ws)
    ws.on('pong', () => alive.add(ws))

    broadcastRoomStateAll(room)
    if (!reconnected) {
      broadcastExcept(room, ws, {
        type: 'participant_joined',
        id: participant.id,
        name: participant.name,
        role: participant.role,
      })
    }

    ws.on('message', (data) => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(data.toString())
      } catch {
        return
      }

      switch (msg.type) {
        case 'vote': {
          if (participant.role !== 'voter' || room.phase !== 'voting') break
          room.castVote(participant.id, msg.card)
          broadcastAll(room, { type: 'vote_cast', participantId: participant.id })
          broadcastRoomStateAll(room)
          break
        }
        case 'reveal': {
          if (room.hostOnlyReveal && !participant.isHost) return
          room.reveal(participant.name)
          broadcastAll(room, {
            type: 'votes_revealed',
            votes: Object.fromEntries(room.votes),
          })
          broadcastRoomStateAll(room)
          break
        }
        case 'reset': {
          if ((room.hostOnlyReveal && !participant.isHost) || room.phase !== 'revealed') break
          room.reset(participant.name)
          broadcastAll(room, { type: 'round_reset' })
          broadcastRoomStateAll(room)
          break
        }
        case 'set_story': {
          if (!participant.isHost) return
          room.setStory(msg.title)
          broadcastRoomStateAll(room)
          break
        }
      }
    })

    ws.on('close', () => {
      alive.delete(ws)
    })
  })
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

function broadcastAll(room: Room, msg: ServerMessage): void {
  for (const p of room.participants.values()) {
    send(p.ws, msg)
  }
}

function broadcastExcept(room: Room, exclude: WebSocket, msg: ServerMessage): void {
  for (const p of room.participants.values()) {
    if (p.ws !== exclude) send(p.ws, msg)
  }
}

function broadcastRoomStateAll(room: Room): void {
  for (const p of room.participants.values()) {
    send(p.ws, buildRoomState(room, p.id))
  }
}

function buildRoomState(room: Room, yourId: string): Extract<ServerMessage, { type: 'room_state' }> {
  return {
    type: 'room_state',
    phase: room.phase,
    deck: room.deck,
    customCards: room.customCards,
    currentStory: room.currentStory,
    participants: room.toParticipantSnapshots(),
    votes: room.phase === 'revealed' ? Object.fromEntries(room.votes) : undefined,
    history: room.history,
    hostOnlyReveal: room.hostOnlyReveal,
    eventLog: room.eventLog,
    yourId,
  }
}
