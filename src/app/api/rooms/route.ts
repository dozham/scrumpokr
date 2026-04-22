import { NextRequest, NextResponse } from 'next/server'
import { createRoom } from '@/lib/registry'
import type { Card, DeckType } from '@/lib/types'

const VALID_DECKS: DeckType[] = ['fibonacci', 'powers-of-2', 'tshirt', 'custom']

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { deck, customCards } = body as { deck: unknown; customCards: unknown }

  if (typeof deck !== 'string' || !VALID_DECKS.includes(deck as DeckType)) {
    return NextResponse.json({ error: 'Invalid deck' }, { status: 400 })
  }
  if (customCards !== undefined && !Array.isArray(customCards)) {
    return NextResponse.json({ error: 'customCards must be an array' }, { status: 400 })
  }
  if (deck === 'custom' && (!Array.isArray(customCards) || customCards.length === 0)) {
    return NextResponse.json({ error: 'Custom deck requires customCards' }, { status: 400 })
  }

  const room = createRoom(deck as DeckType, customCards as Card[] | undefined)
  return NextResponse.json({ roomId: room.id })
}
