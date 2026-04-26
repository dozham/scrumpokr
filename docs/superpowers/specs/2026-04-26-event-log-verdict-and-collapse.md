# Event Log: Verdict Display & Collapsible Design

**Date:** 2026-04-26
**Status:** Approved

## Goal

Two improvements to the Event Log:
1. Show the round verdict inline with each "started a new round" entry
2. Make the event log collapsible, collapsed by default

---

## Verdict Inline with Reset Event

### Data correlation

`room.reset()` always pushes one entry to both `room.history` and `room.eventLog` in the same call. The Kth reset entry in `eventLog` (0-indexed, chronological) corresponds to `history[K]`. When rendering in reverse order (most recent first), the Nth reset event encountered maps to `history[history.length - 1 - N]`.

### New prop

`EventLog` receives a new required prop: `history: RoundResult[]`

### Display format

The reset event text gains a verdict suffix after the existing text:

| `verdictSource` | `consensus` | Suffix |
|-----------------|-------------|--------|
| `'natural'` | any | ` · 🎉 {consensus}` |
| `'selected'` | any | ` · ✓ {consensus}` |
| `'none'` | — | ` · ✗ No consensus` |
| missing (backward compat) | defined | ` · 🎉 {consensus}` |
| missing (backward compat) | undefined | ` · ✗ No consensus` |

The suffix is rendered in a muted color (`text-slate-400 dark:text-gray-500`) to visually separate it from the actor text.

### `RoomClient` change

Pass `history={roomState.history}` to `<EventLog>`.

---

## Collapsible Event Log

### Behavior

- Collapsed by default (`isOpen = false`)
- Clicking the header row toggles open/closed
- When collapsed: only the header is visible
- When open: the entry list is shown as before

### Header

The header becomes a full-width clickable row (`button` element or `onClick` on the header div) showing:
- "Event Log (N)" where N is the total entry count
- A chevron icon: `▶` when collapsed, `▼` when expanded

### Component change

`EventLog` gains `'use client'` and `const [isOpen, setIsOpen] = useState(false)`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/EventLog.tsx` | Add `'use client'`, `useState` for collapse, `history` prop, verdict suffix logic |
| `src/app/room/[id]/RoomClient.tsx` | Pass `history={roomState.history}` to `<EventLog>` |

## Out of Scope

- Persisting collapsed state across page reloads
- Showing the verdict for the *current* (unreset) round in the event log
- Animating the open/close transition
