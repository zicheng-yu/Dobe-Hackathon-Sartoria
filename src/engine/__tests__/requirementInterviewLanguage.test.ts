import { describe, expect, it } from 'vitest';
import { extractRevisionConstraints } from '../requirementInterview';

const observe = (text: string, mode: 'initial' | 'revision' = 'revision') =>
  extractRevisionConstraints({ id: 'customer-turn', text }, mode);

describe('requirement interview language', () => {
  it('keeps exclusions attached to materials with postposed subjects and predicates', () => {
    const observations = observe('羊毛面料一律排除。真丝这种也别拿来。混纺本身也请排掉。');
    expect(observations).toMatchObject([
      { field: 'fabric', op: 'neq', value: 'wool', level: 'hard', quote: '羊毛面料一律排除' },
      { field: 'fabric', op: 'neq', value: 'silk', level: 'hard', quote: '真丝这种也别拿来' },
      { field: 'fabric', op: 'neq', value: 'blend', level: 'hard', quote: '混纺本身也请排掉' },
    ]);
    expect(observe('真丝和羊毛都排除。材料不允许用涤纶。')).toMatchObject([
      { field: 'fabric', op: 'neq', value: 'silk', level: 'hard' },
      { field: 'fabric', op: 'neq', value: 'wool', level: 'hard' },
      { field: 'fabric', op: 'neq', value: 'polyester', level: 'hard' },
    ]);
  });

  it('scopes adjacent predicates when the customer omits punctuation', () => {
    const observations = observe('羊毛面料一律排除有条件的话用真丝必须可机洗不要干洗');
    expect(observations).toMatchObject([
      { field: 'fabric', op: 'neq', value: 'wool', level: 'hard' },
      { field: 'fabric', op: 'eq', value: 'silk', level: 'preference' },
      { field: 'care', op: 'eq', value: 'machine_wash', level: 'hard' },
      { field: 'care', op: 'neq', value: 'dry_clean', level: 'hard' },
    ]);
  });

  it('preserves permission as open and ignores the pictured fabric and color', () => {
    const observations = observe('版师发来的那张酒红丝绒照，我拿来比裙摆比例。丝绒本身可以用。', 'initial');
    expect(observations).toMatchObject([
      { field: 'fabric', value: null, level: 'pending', quote: '丝绒本身可以用' },
    ]);
    expect(observations[0].blocking).toBeUndefined();
    expect(observe('面料可以用真丝，优先选羊毛。成衣可以机洗。', 'initial')).toMatchObject([
      { field: 'fabric', op: 'eq', value: 'wool', level: 'preference' },
      { field: 'care', op: 'eq', value: 'machine_wash', level: 'hard' },
    ]);
    expect(observe('颜色按参考图里的藏青做。', 'initial')).toMatchObject([
      { field: 'color', value: 'navy', level: 'hard' },
    ]);
  });

  it('filters historical objects while retaining current scope and direct exclusions', () => {
    const observations = observe('上一批冬季选的羊毛。库房此前说的是只能干洗。这回用真丝，必须机洗。');
    expect(observations).toMatchObject([
      { field: 'fabric', op: 'eq', value: 'silk', quote: '这回用真丝' },
      { field: 'care', op: 'eq', value: 'machine_wash', quote: '必须机洗' },
    ]);

    const exclusions = observe('我试穿借来的羊毛西装。羊毛也请排掉，之前说的混纺照样不要。');
    expect(exclusions).toMatchObject([
      { field: 'fabric', op: 'neq', value: 'wool', quote: '羊毛也请排掉' },
      { field: 'fabric', op: 'neq', value: 'blend', quote: '之前说的混纺照样不要' },
    ]);
  });

  it('scopes a completed order to its past date and reads a contract explicitly in force now', () => {
    expect(observe('去年订了 12 套且必须藏青；这次确定 9 人，每人一套，必须炭黑色。', 'initial')).toMatchObject([
      { field: 'quantity', op: 'eq', value: 9, level: 'hard' },
      { field: 'color', op: 'eq', value: 'obsidian', level: 'hard' },
    ]);
    expect(observe('去年签的合同现在仍然要求驳领。', 'initial')).toMatchObject([
      { field: 'collar', op: 'eq', value: 'lapel', level: 'hard', quote: '现在仍然要求驳领' },
    ]);
  });

  it('uses a stated carry-over method as a first brief and preserves its source in a revision', () => {
    const text = '洗护照旧走手洗。领型定交领。';
    expect(observe(text, 'initial')).toMatchObject([
      { field: 'collar', op: 'eq', value: 'cross_open' },
      { field: 'care', op: 'eq', value: 'hand_wash', quote: '洗护照旧走手洗' },
    ]);
    expect(observe(text)).toMatchObject([{ field: 'collar', op: 'eq', value: 'cross_open' }]);
  });

  it('keeps suggestions and possible additions soft while skipping questions about cancelling', () => {
    const observations = observe('供应商建议整单换成醋酸。采购只问过能不能取消驳领。版师问前襟能否加玉兰苏绣。沿用订单里的真丝。');
    expect(observations).toMatchObject([
      { field: 'fabric', op: 'eq', value: 'acetate', level: 'preference' },
      { field: 'craft', op: 'eq', value: 'crf-suzhou-magnolia-embroidery', level: 'preference', quote: '版师问前襟能否加玉兰苏绣' },
    ]);
  });

  it('reads a question about adding a requirement as a proposal for the specified value', () => {
    const proposal = '服装管理员问能不能把必须手洗加为一项成衣要求';
    const text = `${proposal}。先把这条挂起。采购问能否把机洗报告纳入洗护条件。版师问能否把驳领要求撤销。`;
    expect(observe(text)).toMatchObject([
      { field: 'care', op: 'eq', value: 'hand_wash', level: 'preference', quote: proposal },
    ]);
  });

  it('retains pending language when approval or a specification is still outstanding', () => {
    const observations = observe('颜色还在核色卡，工艺怎么做还得等版师确认。洗护方式我得问门店。');
    expect(observations).toMatchObject([
      { field: 'color', value: null, state: 'unknown', quote: '颜色还在核色卡' },
      { field: 'care', value: null, state: 'unknown', quote: '洗护方式我得问门店' },
      { field: 'craft', value: null, state: 'unknown', quote: '工艺怎么做还得等版师确认' },
    ]);
    expect(observations.some(({ blocking }) => blocking)).toBe(false);
  });

  it('keeps a direct instruction about craft as a hard exclusion', () => {
    expect(observe('袖口不要做撞色滚边。')).toMatchObject([
      { field: 'craft', op: 'neq', value: 'crf-contrast-piping-cuff', level: 'hard', quote: '袖口不要做撞色滚边' },
    ]);
  });
});
