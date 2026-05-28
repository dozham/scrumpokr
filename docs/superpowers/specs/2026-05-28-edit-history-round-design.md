# Edit History Round — Design Spec

**Date:** 2026-05-28  
**Status:** Approved

## Summary

Allow any participant to edit the story title and verdict of a past round after it has been committed to history (i.e. after clicking "Next Round"). Changes are broadcast in real time to all participants.

## Backend

### New client message

```ts
| { type: 'edit_round'; index: number; story: string; verdict: Card | 'NO_CONSENSUS' | null }
```

- `index` — zero-based index into `room.history` (0 = oldest round)
- `story` — new title string (empty string clears it)
- `verdict` — `Card` to set a consensus value, `'NO_CONSENSUS'` or `null` to mark no consensus

### New `Room` method

```ts
editRound(index: number, story: string, verdict: Card | 'NO_CONSENSUS' | null): void
```

Behaviour:
- Bounds-checks `index`; no-ops if out of range
- Sets `history[index].story = story || undefined`
- If `verdict` is a `Card` (not null, not `'NO_CONSENSUS'`): sets `consensus = verdict`, `verdictSource = 'selected'`
- Otherwise: sets `consensus = undefined`, `verdictSource = 'none'`
- Updates `lastActivityAt`

### Handler

New `case 'edit_round'` in the message switch:
- No phase restriction (works during voting or revealed)
- No host restriction (any participant)
- Calls `room.editRound(msg.index, msg.story, msg.verdict)`
- Calls `broadcastRoomStateAll(room)`

No new server message type is needed; the updated `room_state` snapshot carries the edited history.

## Frontend

### `VotingHistory` component

New prop:
```ts
onEditRound: (index: number, story: string, verdict: Card | 'NO_CONSENSUS' | null) => void
```

New local state:
```ts
editingIndex: number | null  // index of the row currently in edit mode, or null
```

**Display row** — same as today, plus a pencil icon button at the right end (always visible, not hover-only, for mobile compatibility). Clicking it sets `editingIndex` to that row's index.

**Edit row** (rendered when `editingIndex === i`) — replaces the display row with a form containing:
- Text input pre-filled with `round.story ?? ""`
- Verdict section:
  - Chip button for each unique value in `round.votes`
  - "No consensus" chip
  - Small text input for a custom value; typing in it deselects any selected chip
- Save and Cancel buttons

On **Save**: calls `onEditRound(index, story, verdict)` and sets `editingIndex = null`.  
On **Cancel**: discards local form state and sets `editingIndex = null`.

### `RoomClient` component

Adds `handleEditRound`:
```ts
function handleEditRound(index: number, story: string, verdict: Card | 'NO_CONSENSUS' | null) {
  sendMsg({ type: 'edit_round', index, story, verdict })
}
```

Passes `onEditRound={handleEditRound}` to `<VotingHistory>`.

## Types unchanged

`RoundResult`, `ServerMessage`, and `ClientMessage` (beyond the new entry) require no structural changes. `verdictSource: 'selected'` already covers the manually-chosen-verdict case.

## Scope

- No changes to `ResultsSummary`
- No changes to `ParticipantGrid`, `CardPicker`, or any other component
- No new database fields or migration
