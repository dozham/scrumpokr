import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { IncomingMessage } from 'http'
import { getRoom } from '@/lib/registry'
import type { ClientMessage, ServerMessage } from '@/lib/types'
import type { Room } from '@/lib/room'

export function attachWebSocket(server: Server): void {
  // Use noServer mode and manually forward only /ws upgrades.
  // The ws library with `path` option calls abortHandshake(400) on non-matching
  // paths (e.g. /_next/webpack-hmr), which kills Next.js HMR in dev mode.
  const wss = new WebSocketServer({ noServer: true })

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

    if (!roomId || !name || !role || !['voter', 'spectator'].includes(role)) {
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

    const participant = room.addParticipant(name, role, ws)

    broadcastRoomStateAll(room)
    broadcastExcept(room, ws, {
      type: 'participant_joined',
      id: participant.id,
      name: participant.name,
      role: participant.role,
    })

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
          if (!participant.isHost) return
          room.reveal()
          broadcastAll(room, {
            type: 'votes_revealed',
            votes: Object.fromEntries(room.votes),
          })
          broadcastRoomStateAll(room)
          break
        }
        case 'reset': {
          if (!participant.isHost || room.phase !== 'revealed') break
          room.reset()
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
      room.removeParticipant(participant.id)
      broadcastAll(room, { type: 'participant_left', id: participant.id })
      broadcastRoomStateAll(room)
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

function sendRoomState(ws: WebSocket, room: Room, yourId: string): void {
  send(ws, buildRoomState(room, yourId))
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
    yourId,
  }
}
