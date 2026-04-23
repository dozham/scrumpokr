# Random Name Generator Design

**Date:** 2026-04-23  
**Status:** Approved

## Goal

Give users a fun way to pick a name when joining a room — a dice icon inside the name input generates a random adjective + animal combo on click.

## UI

A 🎲 icon button is placed inside the name input field, right-aligned, styled in muted gray matching the placeholder text. On hover it highlights. Clicking fills the input with a randomly selected name. Clicking again generates a different one. The user can still edit the input freely after generation.

The button does not submit the form — it only fills the input value.

## Name List

A static export `RANDOM_NAMES: string[]` in `src/lib/names.ts` — an array of adjective + animal combos (e.g. "FiercePenguin", "LazyPanda", "BoldOtter", "SwiftFox", "GrumpyBadger"). At least 30 names. No external dependencies.

Selection is random using `Math.random()`. No deduplication needed — occasional repeats are fine.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/names.ts` | Create — exports `RANDOM_NAMES` array |
| `src/app/join/[id]/JoinForm.tsx` | Add dice button inside name input |

## Out of Scope

- Animated dice rolling effect
- Avoiding recently-shown names
- Server-side name list
