// ABOUTME: Puts the Verdict cards in order, problems first: red, amber, green, then neutral, each in card-number order.
// ABOUTME: Shows only the start card until their sale price is entered.
import { contractCards } from './contract-checks.js';
import { deskCards } from './desk-checks.js';

// The order the Verdict tab shows the severities in: the problems, then the checks that passed, then the notes
// (SPEC §6.5).
const SEVERITY_ORDER = ['red', 'amber', 'green', 'neutral'];

// The Verdict cards (SPEC §6.5): the desk cards and the contract cards, red first, then amber, green and neutral, and
// in card-number order within each severity. Until their sale price is entered, the start card is the only card.
export function verdictCards(deal, rules, reference) {
  if (!deal.hasSale) {
    return [startCard()];
  }
  return [...deskCards(deal, rules, reference), ...contractCards(deal, reference)].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.number - b.number,
  );
}

// The note that asks for their sale price, which every check needs (SPEC §6.2, §6.5).
function startCard() {
  return {
    key: 'start',
    number: 0,
    severity: 'neutral',
    headline: 'Enter their sale price on the Price tab to start.',
    sentence: 'Every check needs it.',
    context: null,
    math: ['Their sale price: blank'],
  };
}
