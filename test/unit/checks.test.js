// ABOUTME: Checks the order of the Verdict cards and the start note against SPEC.md §6.5 and §7.11's Example 1.
// ABOUTME: Red cards come first, then amber, green and neutral, each severity in card-number order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictCards } from '../../site/lib/checks.js';
import { contractCards } from '../../site/lib/contract-checks.js';
import { deskCards } from '../../site/lib/desk-checks.js';
import { problemCount } from '../../site/lib/display.js';
import { connecticut } from '../../site/rules/connecticut.js';
import { reference } from '../../site/rules/reference.js';
import { dealWith } from '../fixtures.js';

// The Verdict cards for Example 1's deal with `overrides` applied.
function cardsFor(overrides = {}) {
  return verdictCards(dealWith(overrides), connecticut, reference);
}

// Example 1's deal quoted as a payment only, with cards of every severity whose numbers interleave: the red drive-away
// card (9); the amber special rate, outside rate and sticker cards (3, 4, 7); the green special-or-cash, target, doc
// fee, extras and contract amount financed cards (5, 6, 10, 12, 13); and the neutral payment card (1) and the contract
// notes asking for the rest of the disclosure box (14–17).
const EVERY_SEVERITY = {
  theirAprMilli: null,
  stickerCents: 3600000,
  targetCents: 3700000,
  theirDriveAwayCents: 3990000,
  contract: { amountFinancedCents: 3482514 },
};

test('cards go red, amber, green, then neutral, in card-number order within each severity (§6.5)', () => {
  assert.deepEqual(cardsFor(EVERY_SEVERITY).map((card) => [card.severity, card.number]), [
    ['red', 9],
    ['amber', 3],
    ['amber', 4],
    ['amber', 7],
    ['green', 5],
    ['green', 6],
    ['green', 10],
    ['green', 12],
    ['green', 13],
    ['neutral', 1],
    ['neutral', 14],
    ['neutral', 15],
    ['neutral', 16],
    ['neutral', 17],
  ]);
});

test('the Verdict cards are the desk cards and the contract cards, unchanged', () => {
  const deal = dealWith(EVERY_SEVERITY);
  const byNumber = verdictCards(deal, connecticut, reference).toSorted((a, b) => a.number - b.number);
  assert.deepEqual(byNumber, [...deskCards(deal, connecticut, reference), ...contractCards(deal, reference)]);
});

test("Example 1's cards go payment, special rate, outside rate, special-or-cash, doc fee, then extras (§7.11)", () => {
  assert.deepEqual(cardsFor().map((card) => card.key), [
    'payment',
    'specialRate',
    'outsideRate',
    'specialOrCash',
    'docFee',
    'extras',
  ]);
});

test('with no sale price, the only card is the start note (§6.5)', () => {
  assert.deepEqual(cardsFor({ saleCents: null }), [
    {
      key: 'start',
      number: 0,
      severity: 'neutral',
      headline: 'Enter their sale price on the Price tab to start.',
      sentence: 'Every check needs it.',
      context: null,
      math: ['Their sale price: blank'],
    },
  ]);
});

test('Example 1 has 3 problems: the red payment card and the amber special rate and outside rate cards (§7.11)', () => {
  assert.equal(problemCount(cardsFor()), 3);
});
