# Session Persistence Design

**Date:** 2026-04-23  
**Status:** Approved

## Problem

User credentials (`name` and `role`) are stored in `sessionStorage`, which is cleared when the browser tab or window closes. Returning users must re-enter their name and role every time they come back to a room they previously joined.

## Goal

Let users return to a room after closing their browser and quickly rejoin without re-entering their details, while still giving them the option to join as a different person or navigate away.

## Approach

Switch storage from `sessionStorage` to `localStorage` for the two existing keys (`name-${roomId}` and `role-${roomId}`). Add a "Welcome back" screen to `JoinForm` that appears when saved credentials are found.

No new routes, no new storage keys, no server changes.

## Storage

| Key | Value | Written | Read |
|-----|-------|---------|------|
| `name-${roomId}` | string | `JoinForm` on submit | `RoomClient` on mount |
| `role-${roomId}` | `'voter'` \| `'spectator'` | `JoinForm` on submit | `RoomClient` on mount |

Both keys move from `sessionStorage` to `localStorage`. No other keys are added.

"Join as someone new" removes both keys before rendering the normal join form so the old identity does not persist.

## UI Flow

### Returning user (saved identity found)

`JoinForm` reads localStorage on mount. If `name-${roomId}` and `role-${roomId}` are both present, render the welcome-back screen:

```
Welcome back, [name]!
You previously joined this room as a [voter / spectator].

[Rejoin as [name]]   [Join as someone new]   [← Create a room]
```

- **Rejoin as [name]** — `router.push('/room/[id]')` immediately (no form submit needed)
- **Join as someone new** — removes both localStorage keys, switches component state to show the normal join form
- **← Create a room** — `router.push('/')`

### New user (no saved identity)

Normal join form renders exactly as today. On submit, writes to `localStorage` instead of `sessionStorage`.

## Files Changed

| File | Change |
|------|--------|
| `src/app/join/[id]/JoinForm.tsx` | Add welcome-back screen; write to `localStorage` |
| `src/app/room/[id]/RoomClient.tsx` | Read from `localStorage` instead of `sessionStorage` |

## Out of Scope

- Persisting the participant ID across reconnects (server is in-memory; every reconnect gets a new ID regardless)
- Global name memory across rooms
- Expiry / TTL on stored credentials
