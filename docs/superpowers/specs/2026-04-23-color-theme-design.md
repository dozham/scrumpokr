# Color Theme Design

**Date:** 2026-04-23
**Status:** Approved

## Goal

Add dark/light theme switching to ScrumPokr. Dark theme is unchanged (current colors). Light theme is colorful and playful — sky blue base with vivid accent colors, inspired by Miro's energetic aesthetic.

## Theme Architecture

Use Tailwind v4's `@variant` directive to wire the built-in `dark:` prefix to a `data-theme="dark"` attribute on `<html>` instead of the OS media query. This lets us control the theme explicitly via JavaScript.

`globals.css` adds one line:
```css
@variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

All components then use dual-class syntax: e.g. `bg-white dark:bg-gray-900`. The dark classes are the existing ones; light classes are added alongside them.

`<html>` starts with `data-theme="dark"` set statically in `layout.tsx`. A `ThemeProvider` client component reads `localStorage` on mount and may switch to `data-theme="light"`. Defaulting to dark means zero flash of wrong theme for new users.

## ThemeProvider

New client component `src/components/ThemeProvider.tsx`. On mount, reads `localStorage.getItem('theme')`. If `'light'`, sets `document.documentElement.setAttribute('data-theme', 'light')`. On toggle, flips the attribute and writes back to localStorage. Exposes a `useTheme()` hook (context) returning `{ theme, toggleTheme }`.

`layout.tsx` wraps `{children}` in `<ThemeProvider>` and sets `data-theme="dark"` on `<html>` as the static default.

## ThemeToggle Component

New component `src/components/ThemeToggle.tsx`. A button that calls `toggleTheme()` from `useTheme()`. Renders `☀️` in dark mode (click to go light) and `🌙` in light mode (click to go dark). Styled as a small icon button matching the header.

Placed top-right in each page: in `RoomClient.tsx` it goes alongside the existing "Copy invite link" button in the header bar. In `page.tsx` and `JoinForm.tsx` (which have no header), it is absolutely positioned in the top-right corner of the viewport (`fixed top-3 right-4`).

## Light Theme Palette (Sky & Candy)

| Element | Light | Dark (existing) |
|---------|-------|-----------------|
| Page background | `sky-50` `#f0f9ff` | `gray-950` |
| Panel / card surface | `white` | `gray-900` |
| Secondary surface | `sky-50` | `gray-800` |
| Panel border | `sky-200` | `gray-800` |
| Strong border | `sky-300` | `gray-700` |
| Primary text | `slate-900` | `white` |
| Secondary text | `sky-600` | `gray-400` |
| Muted text | `slate-500` | `gray-500` |
| Accent (button bg, selected card) | `sky-500` | `indigo-600` |
| Accent hover | `sky-600` | `indigo-500` |
| Accent shadow | `rgba(14,165,233,0.35)` | `rgba(79,70,229,0.35)` |
| Voted card (not revealed) | `sky-100` bg, `sky-400` border, `sky-700` text | `green-900` bg, `green-600` border, `green-300` text |
| Revealed card (has vote) | `sky-100` bg, `sky-400` border | `green-800` bg, `green-500` border |
| Label text (uppercase headers) | `sky-600` | `gray-400` |
| Input background | `white` | `gray-800` |
| Checkbox/toggle accent | `sky-500` | `indigo-600` |

## Participant Badges (ParticipantGrid)

In light mode, participant name labels get per-person color pills cycling through: `sky`, `violet`, `emerald`, `amber`, `rose`. Color is derived from the participant's index in the list. In dark mode, labels remain plain `text-gray-400` (no change).

Badge rendering is in `ParticipantGrid.tsx`. A helper `getBadgeColors(index)` returns Tailwind class strings for bg and text based on `index % 5`.

## Files Changed

| File | Change |
|------|--------|
| `src/app/globals.css` | Add `@variant dark` directive |
| `src/app/layout.tsx` | Add `data-theme="dark"` to `<html>`; wrap children in `<ThemeProvider>` |
| `src/components/ThemeProvider.tsx` | New — context, localStorage, `data-theme` setter, `useTheme()` hook |
| `src/components/ThemeToggle.tsx` | New — ☀️/🌙 button |
| `src/app/page.tsx` | Add `ThemeToggle` to header; add light-mode classes to all elements |
| `src/app/join/[id]/JoinForm.tsx` | Same |
| `src/app/room/[id]/RoomClient.tsx` | Same + `ThemeToggle` in header |
| `src/components/CardPicker.tsx` | Add light-mode classes |
| `src/components/ParticipantGrid.tsx` | Add light-mode classes + badge color cycling |
| `src/components/ResultsSummary.tsx` | Add light-mode classes |
| `src/components/VotingHistory.tsx` | Add light-mode classes |
| `src/components/EventLog.tsx` | Add light-mode classes |

## Out of Scope

- System preference auto-detection (`prefers-color-scheme`) — user must manually toggle
- Per-room theme persistence — theme is global, stored in localStorage
- Animated theme transition effects
- More than two themes
