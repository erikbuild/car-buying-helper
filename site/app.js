// ABOUTME: Connects the page to the deal checks: reads the fields and extras, and renders the strip, tabs and cards.
// ABOUTME: Also runs the tabs, the down payment and extras buttons and Start over, and registers the offline cache.
import { verdictCards } from './lib/checks.js';
import { deriveDeal } from './lib/deal.js';
import { amountFinancedLine, extraLine, keyNumbers, priceTabLines, summaryStrip } from './lib/display.js';
import {
  FIELD_NAMES,
  addExtra,
  editExtra,
  editField,
  emptyForm,
  removeExtra,
  setTakingCash,
  stepDownPayment,
} from './lib/form.js';
import { readInputs } from './lib/inputs.js';
import { connecticut } from './rules/connecticut.js';
import { reference } from './rules/reference.js';

// The state whose rules the deal is checked against.
const rules = connecticut;

// The word beside each card's color, so color is never the only signal (SPEC §9).
const SEVERITY_WORDS = { red: 'Problem', amber: 'Check', green: 'OK', neutral: 'Note' };

const START_OVER_QUESTION = 'Start over? This clears the whole deal.';

const strip = document.querySelector('.strip');
const tabs = [...document.querySelectorAll('[role="tab"]')];
const takingCashSwitch = document.getElementById('takingCash');

// The deal as typed: every field's text, the switch, the down payment their quote is tied to, and the extras.
let form = emptyForm();

// An element with these attributes, holding these children, which are elements or text.
function element(tag, attributes, children) {
  const created = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    created.setAttribute(name, value);
  }
  created.append(...children);
  return created;
}

function setText(selector, text) {
  document.querySelector(selector).textContent = text;
}

// Shows what the form works out to: the strip, the Price and Loan tabs' lines, each field's error, the extras and the
// Verdict. It never writes the text of a field that's already on the page, so typing in a field is never interrupted.
function render(form) {
  const { inputs, errors, extraErrors, dateHint } = readInputs(form);
  const deal = deriveDeal(inputs, rules);
  const cards = verdictCards(deal, rules, reference);
  renderStrip(summaryStrip(deal, cards));
  renderPriceTab(priceTabLines(deal, rules));
  setText('[data-calc="amount-financed"]', amountFinancedLine(deal));
  renderFieldMessages(errors, dateHint);
  renderExtras(form.extras, deal, extraErrors);
  renderVerdict(keyNumbers(deal), cards);
}

// The summary strip (SPEC §6.1). Their payment's line hides itself while it's empty.
function renderStrip({ driveAway, shouldBe, theirs, problems }) {
  setText('[data-strip="drive-away"]', driveAway);
  setText('[data-strip="should-be"]', shouldBe);
  setText('[data-strip="theirs"]', theirs ?? '');
  setText('[data-strip="problems"]', problems);
}

// The Price tab's calculated lines, and the check under each figure from their sheet, which is empty and takes no room
// while that figure is blank (SPEC §6.2).
function renderPriceTab({ discount, taxLine, dmv, driveAway, theirTaxCheck, theirDriveAwayCheck }) {
  setText('[data-calc="discount"]', discount);
  setText('[data-calc="tax-line"]', taxLine);
  setText('[data-calc="dmv"]', dmv);
  setText('[data-calc="drive-away"]', driveAway);
  setText('[data-calc="their-tax-check"]', theirTaxCheck ?? '');
  setText('[data-calc="their-drive-away-check"]', theirDriveAwayCheck ?? '');
}

// Each field's inline error, and the contract dates' hint while only one of them is entered (SPEC §6.3, §9).
function renderFieldMessages(errors, dateHint) {
  for (const name of FIELD_NAMES) {
    setText(`[data-error-for="${name}"]`, errors[name] ?? '');
  }
  setText('[data-hint-for="contractDates"]', dateHint ?? '');
}

// The Extras tab's list, with an item for each extra in the form (SPEC §6.4), and each item's line and price error.
// An extra that's new to the page gets an item at the end of the list, which is where the form adds extras, and the
// item of an extra that's gone is removed. An item already on the page keeps its controls as they are.
function renderExtras(extras, deal, extraErrors) {
  const list = document.querySelector('[data-extras]');
  const ids = new Set(extras.map(({ id }) => id));
  for (const item of [...list.children]) {
    if (!ids.has(item.dataset.extraId)) {
      item.remove();
    }
  }
  for (const extra of extras) {
    const shown = [...list.children].find((item) => item.dataset.extraId === extra.id);
    const item = shown ?? list.appendChild(extraItem(extra));
    item.querySelector('[data-extra-line]').textContent = extraLine(deal, extra.id);
    item.querySelector('[data-extra-error]').textContent = extraErrors[extra.id] ?? '';
  }
}

// An extra's item: its name, its price with the price's error under it, the line saying what it costs, its type's
// tip, its In the deal and Taxed switches, the hint on Taxed when its type has one, and Remove. The controls start
// with the extra's values from the form.
function extraItem(extra) {
  const { id, type } = extra;
  const { tip, taxedHint } = rules.extraTypes[type];
  const errorId = `${id}-error`;
  const taxedHintId = `${id}-taxed-hint`;
  const textInput = { type: 'text', autocomplete: 'off' };
  const switchInput = { type: 'checkbox', role: 'switch' };
  const parts = [
    element('div', { class: 'field' }, extraControl(extra, 'name', 'Name', textInput)),
    element('div', { class: 'field' }, [
      ...extraControl(extra, 'priceText', 'Price', { ...textInput, inputmode: 'decimal', 'aria-describedby': errorId }),
      element('p', { id: errorId, 'data-extra-error': '' }, []),
    ]),
    element('p', { 'data-extra-line': '' }, []),
  ];
  if (tip !== null) {
    parts.push(element('p', { class: 'tip' }, [tip]));
  }
  const taxedInput = taxedHint === null ? switchInput : { ...switchInput, 'aria-describedby': taxedHintId };
  parts.push(
    element('div', { class: 'switch-row' }, extraControl(extra, 'inDeal', 'In the deal', switchInput)),
    element('div', { class: 'switch-row' }, extraControl(extra, 'taxed', 'Taxed', taxedInput)),
  );
  if (taxedHint !== null) {
    parts.push(element('p', { class: 'hint', id: taxedHintId }, [taxedHint]));
  }
  const remove = element('button', { type: 'button', 'data-remove-extra': '' }, ['Remove']);
  remove.addEventListener('click', () => update(removeExtra(form, id)));
  parts.push(remove);
  return element('li', { 'data-extra-id': id, 'data-extra-type': type }, parts);
}

// The label and input for one part of an extra (name, priceText, inDeal or taxed). The input starts with the extra's
// value for that part: its text, or for a switch, whether it's on.
function extraControl(extra, part, label, attributes) {
  const input = element('input', { id: `${extra.id}-${part}`, 'data-extra-field': part, ...attributes }, []);
  if (input.type === 'checkbox') {
    input.checked = extra[part];
  } else {
    input.value = extra[part];
  }
  return [element('label', { for: input.id }, [label]), input];
}

// The Verdict tab's key numbers, as label and value rows, and its cards (SPEC §6.5).
function renderVerdict(numbers, cards) {
  const rows = numbers.map(({ label, value }) => element('div', {}, [
    element('dt', {}, [label]),
    element('dd', {}, [value]),
  ]));
  document.querySelector('[data-key-numbers]').replaceChildren(...rows);
  document.querySelector('[data-cards]').replaceChildren(...cards.map(cardElement));
}

// A Verdict card: its severity word, its headline, its sentence, its context line when it has one, and its math behind
// "Show the math".
function cardElement({ key, severity, headline, sentence, context, math }) {
  const parts = [
    element('span', { class: 'severity' }, [SEVERITY_WORDS[severity]]),
    element('h3', {}, [headline]),
    element('p', {}, [sentence]),
  ];
  if (context !== null) {
    parts.push(element('p', { class: 'context' }, [context]));
  }
  const mathLines = element('ul', {}, math.map((line) => element('li', {}, [line])));
  parts.push(element('details', {}, [element('summary', {}, ['Show the math']), mathLines]));
  return element('article', { 'data-card': key, 'data-severity': severity }, parts);
}

// Makes `next` the page's form and shows what it works out to.
function update(next) {
  form = next;
  render(form);
}

// Writes one field's text from the form into its input.
function writeField(name) {
  document.getElementById(name).value = form.fields[name];
}

// Writes every field's text and the switch from the form into the page, as on load and after Start over.
function writeFields() {
  for (const name of FIELD_NAMES) {
    writeField(name);
  }
  takingCashSwitch.checked = form.takingCash;
}

// Reads a field's text, the switch, or one of an extra's controls into the form.
function readControl(control) {
  if (FIELD_NAMES.includes(control.id)) {
    update(editField(form, control.id, control.value));
  } else if (control === takingCashSwitch) {
    update(setTakingCash(form, control.checked));
  } else if (control.matches('[data-extra-field]')) {
    const { extraId } = control.closest('[data-extra-id]').dataset;
    const value = control.type === 'checkbox' ? control.checked : control.value;
    update(editExtra(form, extraId, { [control.dataset.extraField]: value }));
  }
}

// Shows this tab's panel and hides the others.
function selectTab(selected) {
  for (const tab of tabs) {
    tab.setAttribute('aria-selected', String(tab === selected));
    document.getElementById(tab.getAttribute('aria-controls')).hidden = tab !== selected;
  }
}

// Opens the Verdict tab and scrolls its top to just below the strip, from anywhere on the page, so the key numbers
// and the cards fill the screen for a screenshot (SPEC §6.5). Rounding down keeps the panel from starting under the
// strip.
function showVerdict() {
  selectTab(document.getElementById('tab-verdict'));
  const panelTop = document.getElementById('panel-verdict').getBoundingClientRect().top + window.scrollY;
  window.scrollTo(0, Math.floor(panelTop - strip.getBoundingClientRect().height));
}

// Text fields are read on every keystroke. Change events read the date pickers and the switches, which some browsers
// report only that way. A text field's change event comes when it loses focus, which can be after a down payment
// button has moved the down payment, so reading it again would tie their quote to the moved one (SPEC §6.3).
document.addEventListener('input', (event) => readControl(event.target));
document.addEventListener('change', (event) => {
  if (event.target.type !== 'text') {
    readControl(event.target);
  }
});

for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab));
}

document.querySelector('[data-strip="problems"]').addEventListener('click', showVerdict);

// The −$500 and +$500 buttons move the down payment, stopping at $0 (SPEC §6.3).
for (const button of document.querySelectorAll('[data-step-down]')) {
  button.addEventListener('click', () => {
    update(stepDownPayment(form, Number(button.dataset.stepDown)));
    writeField('downPayment');
  });
}

// Each add button adds an extra of its type (SPEC §6.4).
for (const button of document.querySelectorAll('[data-add-extra]')) {
  button.addEventListener('click', () => update(addExtra(form, button.dataset.addExtra, rules)));
}

document.querySelector('[data-start-over]').addEventListener('click', () => {
  if (confirm(START_OVER_QUESTION)) {
    update(emptyForm());
    writeFields();
  }
});

setText('[data-hint-for="salePrice"]', rules.hints.salePrice);
document.querySelector('[data-checklist]').replaceChildren(...rules.checklist.map((item) => element('li', {}, [item])));
writeFields();
render(form);

// Registers the offline cache, so the page opens with no signal after one online visit.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('offline.js', { updateViaCache: 'none' });
}
