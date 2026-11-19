// Plain-language masking choices. Each maps to a UEM masking function + parameters.
import { mask, sampleFor } from '@sdk/masking.js';

export const PRESETS = [
  { id: 'last4', label: 'Show last 4', fn: 'PARTIAL_MASK', p: { showFirst: 0, showLast: 4 } },
  { id: 'last2', label: 'Show last 2', fn: 'PARTIAL_MASK', p: { showFirst: 0, showLast: 2 } },
  { id: 'first3last2', label: 'Show first 3 and last 2', fn: 'PARTIAL_MASK', p: { showFirst: 3, showLast: 2 } },
  { id: 'first1', label: 'Show first letter only', fn: 'PARTIAL_MASK', p: { showFirst: 1, showLast: 0 } },
  { id: 'aadhaar', label: 'Aadhaar style (XXXX XXXX 1234)', fn: 'PATTERN_MASK', p: { template: 'XXXX XXXX ####' } },
  { id: 'email', label: 'Email (first letter, keep .com)', fn: 'EMAIL_MASK', p: { localVisibleChars: 1, localVisibleLastChars: 0, domainMode: 'MASK_KEEP_TLD' } },
  { id: 'hide', label: 'Hide completely (****)', fn: 'FULL_MASK', p: {} },
];
export const CUSTOM = 'custom';

const int = (v) => (v === undefined || v === null || v === '' ? 0 : parseInt(v, 10) || 0);

function canon(fn, p = {}) {
  switch (fn) {
    case 'PARTIAL_MASK':
      return `P|${int(p.showFirst)}|${int(p.showLast)}|${p.maskChar || '*'}`;
    case 'PATTERN_MASK':
      return `T|${p.template || ''}|${p.inputFormat || ''}`;
    case 'EMAIL_MASK':
      return `E|${int(p.localVisibleChars)}|${int(p.localVisibleLastChars)}|${p.domainMode || 'MASK_KEEP_TLD'}`;
    case 'FULL_MASK':
      return `F|${p.preserveLength === true || p.preserveLength === 'true'}|${p.maskChar || '*'}`;
    default:
      return 'X|' + fn;
  }
}

/** The preset matching a masking, or 'custom'. */
export function presetOf(masking) {
  if (!masking) return CUSTOM;
  const key = canon(masking.function, masking.params);
  const hit = PRESETS.find((x) => canon(x.fn, x.p) === key);
  return hit ? hit.id : CUSTOM;
}

export function maskingOfPreset(id) {
  const x = PRESETS.find((p) => p.id === id);
  return x ? { function: x.fn, params: { ...x.p } } : null;
}

/** A short human description of a masking. */
export function describeMasking(masking) {
  if (!masking) return '—';
  const id = presetOf(masking);
  if (id !== CUSTOM) return PRESETS.find((x) => x.id === id).label;
  const p = masking.params || {};
  switch (masking.function) {
    case 'PARTIAL_MASK':
      return `Show first ${int(p.showFirst)}, last ${int(p.showLast)}`;
    case 'PATTERN_MASK':
      return `Pattern ${p.template || ''}`;
    case 'EMAIL_MASK':
      return `Email (first ${int(p.localVisibleChars)})`;
    case 'FULL_MASK':
      return p.preserveLength ? 'Hide, keep length' : 'Hide completely';
    default:
      return masking.function;
  }
}

/** Sample value → masked value for a field, optionally with a label before it. */
export function previewOf(field, after) {
  if (!field) return null;
  const sample = sampleFor(field.code);
  const masked = mask(sample, field.masking?.function, field.masking?.params || {});
  return after ? { from: `${after} ${sample}`, to: `${after} ${masked}` } : { from: sample, to: masked };
}

export function previewOfMasking(code, masking) {
  const sample = sampleFor(code);
  return { from: sample, to: mask(sample, masking?.function, masking?.params || {}) };
}
