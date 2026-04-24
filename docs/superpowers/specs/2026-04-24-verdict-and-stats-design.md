# Verdict Selection, Richer Stats & Self-Highlight Design

**Date:** 2026-04-24
**Status:** Approved

## Goal

Three related improvements to the revealed-votes screen:
1. Any participant can pick a final verdict when there's no natural consensus (or explicitly choose "No consensus")
2. Stats row shows Avg, Median, Min, Max, and Most Voted
3. Your own card is subtly highlighted in the participants grid

---

## Verdict Selection

### When it appears
Only during the `revealed` phase when there is no natural consensus (i.e. `selectedVerdict` is undefined in the current room state and `consensus` would be undefined).

When natural consensus exists, the existing `🎉 Consensus: X` display is shown instead — no verdict picker.

### UI (in `ResultsSummary.tsx`)
Below the stats row, a compact verdict section appears:

- **No selection yet:** "Pick verdict:" label followed by pill buttons for each unique voted value, plus a "No consensus" button
- **Card selected:** Amber badge "✓ Verdict: 5" — clicking it returns to the picker
- **"No consensus" selected:** Muted badge "✗ No consensus" — clicking it returns to the picker

`ResultsSummary` receives two new props:
- `selectedVerdict?: Card | 'NO_CONSENSUS'`
- `onSelectVerdict: (v: Card | 'NO_CONSENSUS') => void`

### Server

**`types.ts`:**
- `ClientMessage` gains `{ type: 'select_verdict'; card: Card | 'NO_CONSENSUS' }`
- `room_state` ServerMessage gains `selectedVerdict?: Card | 'NO_CONSENSUS'`
- `RoundResult` gains `verdictSource: 'natural' | 'selected' | 'none'` — stored at reset time so history icons are deterministic regardless of who was in the room

**`room.ts`:**
- New field `selectedVerdict: Card | 'NO_CONSENSUS' | undefined` (cleared on `reset()`)
- New method `selectVerdict(card: Card | 'NO_CONSENSUS'): void`
- Updated `reset()`:
  ```
  naturalConsensus = computeConsensus()
  if natural → consensus = natural, verdictSource = 'natural'
  else if selectedVerdict is a Card → consensus = selectedVerdict, verdictSource = 'selected'
  else → consensus = undefined, verdictSource = 'none'
  ```
- `selectedVerdict` cleared after `reset()`

**`handler.ts`:**
- Handle `select_verdict` message: call `room.selectVerdict(msg.card)`, broadcast `broadcastRoomStateAll(room)`

---

## Richer Stats

`ResultsSummary.tsx` stats row order: **Avg → Median → Min → Max → Most Voted**

| Stat | Input | Logic |
|------|-------|-------|
| Avg | numeric votes only | sum / count, 1 decimal |
| Median | numeric votes only | sort, take middle; average of two middles if even count, 1 decimal |
| Min | numeric votes only | `Math.min` |
| Max | numeric votes only | `Math.max` |
| Most Voted | all votes (including t-shirt) | most frequent value(s); ties shown as `3 / 5` |

All show `—` when there are no applicable votes.

---

## Self-Highlight in Participant Grid

`ParticipantGrid` receives a new prop `yourId: string`.

The card face for the current user (`p.id === yourId`) gets a subtle `ring-2` highlight:
- Light mode: `ring-sky-400`
- Dark mode: `dark:ring-indigo-400`

The name label for the current user is rendered `font-semibold` instead of the default weight.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `select_verdict` to ClientMessage; `selectedVerdict` to room_state; `verdictSource` to RoundResult |
| `src/lib/room.ts` | Add `selectedVerdict` field, `selectVerdict()` method, update `reset()` |
| `src/ws/handler.ts` | Handle `select_verdict` message |
| `src/components/ResultsSummary.tsx` | Add Median + Most Voted stats; verdict picker UI |
| `src/components/VotingHistory.tsx` | Icon prefix per round (🎉 / ✓ / ✗) using `verdictSource` |
| `src/components/ParticipantGrid.tsx` | Add `yourId` prop, highlight self card and name |
| `src/app/room/[id]/RoomClient.tsx` | Pass `selectedVerdict`, `onSelectVerdict`, and `yourId` to components; handle `select_verdict` message |

## Backward Compatibility

Existing `RoundResult` entries in memory (before this change) have no `verdictSource`. `VotingHistory` treats a missing `verdictSource` as: `'natural'` if `consensus !== undefined`, `'none'` if `consensus === undefined`.

## Out of Scope

- Changing a verdict after "Next Round" (history is immutable)
- Voting on the verdict (one click picks it, no multi-vote)
- Showing who picked the verdict
