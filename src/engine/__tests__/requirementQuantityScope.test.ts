import { describe, expect, it } from 'vitest';
import { extractRevisionConstraints } from '../requirementInterview';

function quantities(text: string) {
  return extractRevisionConstraints({ id: 'quantity-scope', text })
    .filter(({ field }) => field === 'quantity')
    .map(({ value, quantityScope, blocking }) => ({ value, quantityScope, blocking }));
}

describe('quantity wording and scope', () => {
  it.each([
    '全单先做六十套，首批做二十套。',
    '整单先订六十套首批先做二十套。',
    '整单先订六十套中先做二十套。',
  ])('distinguishes the order total and the first batch in %s', (text) => {
    expect(quantities(text)).toEqual([
      { value: 60, quantityScope: 'order', blocking: undefined },
      { value: 20, quantityScope: 'batch', blocking: undefined },
    ]);
  });

  it.each([
    '先安排量体后再做六十套。',
    '先做完六十套再验收。',
    '先做六十套西装再验收。',
  ])('keeps a production sequence at order scope in %s', (text) => {
    expect(quantities(text)).toEqual([{ value: 60, quantityScope: 'order', blocking: undefined }]);
  });

  it.each([
    '先下二十套。',
    '先订西装二十套。',
    '首批做二十套西装再验收。',
    '首批总套数二十套。',
  ])('recognizes a first order or a named batch in %s', (text) => {
    expect(quantities(text)).toEqual([{ value: 20, quantityScope: 'batch', blocking: undefined }]);
  });
});
