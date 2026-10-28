// ABOUTME: Reads Verdict cards the way the tests check them.
// ABOUTME: verdictOf gives a card's severity and headline, which SPEC.md §6.5 words exactly.

// A card's severity and headline, the parts the tests check exactly (SPEC §6.5).
export function verdictOf(card) {
  return [card.severity, card.headline];
}
