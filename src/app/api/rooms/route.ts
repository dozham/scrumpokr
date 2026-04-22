import { NextRequest, NextResponse } from 'next/server'
import { createRoom } from '@/lib/registry'
import type { Card, DeckType } from '@/lib/types'

const VALID_DECKS: DeckType[] = ['fibonacci', 'powers-of-2', 'tshirt', 'custom']

export async function POST(req: NextRequest) {
  const body = await req.json()
  const deck = body.deck as DeckType
  const customCards = body.customCards as Card[] | undefined

  if (!VALID_DECKS.includes(deck)) {
    return NextResponse.json({ error: 'Invalid deck' }, { status: 400 })
  }
  if (deck === 'custom' && (!customCards || customCards.length === 0)) {
    return NextResponse.json({ error: 'Custom deck requires customCards' }, { status: 400 })
  }

  const room = createRoom(deck, customCards)
  return NextResponse.json({ roomId: room.id })
}
