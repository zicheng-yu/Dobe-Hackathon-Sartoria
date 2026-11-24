import { describe, expect, it } from 'vitest';
import { extractRevisionConstraints } from '../requirementInterview';

const read = (text: string, mode: 'initial' | 'revision' = 'revision') =>
  extractRevisionConstraints({ id: 'customer', text }, mode);

describe('requirement stance and scope', () => {
  it('distinguishes care exclusions, preferences and withdrawals', () => {
    expect(read('成衣必须能手洗不能要求干洗。')).toMatchObject([
      { field: 'care', op: 'eq', value: 'hand_wash', level: 'hard' },
      { field: 'care', op: 'neq', value: 'dry_clean', level: 'hard', sourceTurnId: 'customer' },
    ]);
    expect(read('我不想再送干洗了。')).toMatchObject([
      { field: 'care', op: 'neq', value: 'dry_clean', level: 'preference' },
    ]);
    expect(read('原单不再要求干洗。')).toMatchObject([
      { field: 'care', level: 'pending', value: null, withdraws: { op: 'eq', value: 'dry_clean' } },
    ]);
  });

  it('leaves a color sample open until the decision maker chooses a color', () => {
    expect(read('先看一看松绿样卡，颜色得等经理定。面料正式确定用真丝。', 'initial')).toMatchObject([
      { field: 'fabric', value: 'silk', level: 'hard' },
      { field: 'color', value: null, level: 'pending', quote: '颜色得等经理定' },
    ]);
    expect(read('暖灰先拿来看看，最后已经确定藏青。', 'initial')).toMatchObject([
      { field: 'color', value: 'navy', level: 'hard', quote: '最后已经确定藏青' },
    ]);
    expect(read('颜色还要等经理正式定藏青。', 'initial')).toMatchObject([
      { field: 'color', value: null, level: 'pending', quote: '颜色还要等经理正式定藏青' },
    ]);
    expect(read('颜色还没定，经理正式确定用藏青。', 'initial')).toMatchObject([
      { field: 'color', value: 'navy', level: 'hard', quote: '经理正式确定用藏青' },
    ]);
  });

  it('leaves undecided wear and scheduling clauses open without borrowing neighboring predicates', () => {
    expect(read('就按交领。秋天这件穿不穿，负责人还在考虑。', 'initial')).toMatchObject([
      { field: 'season', value: null, level: 'pending', quote: '秋天这件穿不穿' },
      { field: 'collar', value: 'cross_open', level: 'hard' },
    ]);
    const schedule = read('春天还是夏天要等场地方公布档期。', 'initial');
    expect(schedule).toMatchObject([{ field: 'season', value: null, level: 'pending' }]);
    expect(schedule[0].blocking).toBeUndefined();
    const choices = read('驳领我还没想好面料定为真丝。', 'initial');
    expect(choices).toMatchObject([
      { field: 'collar', value: null, level: 'pending' },
      { field: 'fabric', value: 'silk', level: 'hard' },
    ]);
    expect(choices[0].blocking).toBeUndefined();
  });

  it('uses the confirmation of a selected value to resolve prior alternatives', () => {
    expect(read('春天还是秋天最终定秋天。')).toMatchObject([
      { field: 'season', level: 'hard', value: 'autumn', quote: '春天还是秋天最终定秋天' },
    ]);
    expect(read('不要羊毛。面料还在考虑。最后正式确定用真丝。')).toMatchObject([
      { field: 'fabric', op: 'neq', value: 'wool', level: 'hard', quote: '不要羊毛' },
      { field: 'fabric', op: 'eq', value: 'silk', level: 'hard', quote: '最后正式确定用真丝' },
    ]);
    expect(read('最终确定用真丝。面料还在考虑。')).toMatchObject([
      { field: 'fabric', value: 'silk', level: 'hard' },
      { field: 'fabric', value: null, level: 'pending', quote: '面料还在考虑' },
    ]);
    expect(read('色系还没定。采购建议今天正式确认用浅蓝。')).toMatchObject([
      { field: 'color', value: 'mist_blue', level: 'preference' },
      { field: 'color', value: null, level: 'pending', quote: '色系还没定' },
    ]);
  });

  it('retains the original question or review instruction for undecided fields', () => {
    expect(read('洗护要等我问门店怎么打理。色系想拿布样到窗口选。领型看了样衣再给句准话。')).toMatchObject([
      { field: 'collar', level: 'pending', quote: '领型看了样衣再给句准话' },
      { field: 'color', level: 'pending', quote: '色系想拿布样到窗口选' },
      { field: 'care', level: 'pending', quote: '洗护要等我问门店怎么打理' },
    ]);
  });

  it('resolves a plural rejection using the two variants tried in the adjacent clause', () => {
    const quote = '店里送来过立领和交领给我们试穿；这两款全都不用';
    expect(read(`${quote}。`, 'initial')).toMatchObject([
      { field: 'collar', op: 'neq', value: 'stand', level: 'hard', quote, sourceTurnId: 'customer' },
      { field: 'collar', op: 'neq', value: 'cross_open', level: 'hard', quote, sourceTurnId: 'customer' },
    ]);
    expect(read('先试过真丝和羊毛。颜色还没定。这两个都别用。')).not.toContainEqual(
      expect.objectContaining({ op: 'neq' }),
    );
    expect(read('试了真丝和交领，这两种都别做。')).not.toContainEqual(expect.objectContaining({ op: 'neq' }));
    expect(read('试了立领和交领，这两个都别做得太紧。')).not.toContainEqual(expect.objectContaining({ op: 'neq' }));
    expect(read('领型确认交领。试过立领以及驳领，这两个都别做。')).toMatchObject([
      { field: 'collar', op: 'eq', value: 'cross_open', level: 'hard', quote: '领型确认交领' },
      { field: 'collar', op: 'neq', value: 'stand', level: 'hard' },
      { field: 'collar', op: 'neq', value: 'lapel', level: 'hard' },
    ]);
  });

  it('keeps a reference color open and excludes a different color when buying fabric', () => {
    expect(read('颜色可参考暖灰色。采购不要购买酒红色布料。', 'initial')).toMatchObject([
      { field: 'color', op: 'neq', value: 'crimson', level: 'hard', quote: '采购不要购买酒红色布料' },
      { field: 'color', value: null, level: 'pending', quote: '颜色可参考暖灰色' },
    ]);
  });

  it('preserves an adjacent color reference alongside an unlisted procurement exclusion', () => {
    const reference = '颜色可以参考蓝色';
    const exclusion = '采购时不要买红色面料';
    const quote = `${reference}。${exclusion}`;
    const [review] = read(`${exclusion}。`, 'initial');
    expect(review).toMatchObject({ field: 'color', value: null, level: 'pending', blocking: true });
    expect(read(`${quote}。`, 'initial')).toMatchObject([{ ...review, id: expect.any(String), quote }]);
    expect(read(`${exclusion}。${reference}。`, 'initial')).toMatchObject([
      { ...review, id: expect.any(String), quote: `${exclusion}。${reference}` },
    ]);
  });

  it.each([
    '另一单颜色可以参考蓝色。',
    '颜色可以参考蓝色。领型必须用立领。',
    '颜色可以参考蓝色。\n\n',
  ])('leaves an unrelated color reference outside the exclusion quote after %s', (context) => {
    const quote = '采购时不要买红色面料';
    const colors = read(`${context}${quote}。`, 'initial').filter(({ field }) => field === 'color');
    expect(colors).toMatchObject([{ field: 'color', value: null, level: 'pending', blocking: true, quote }]);
  });

  it('replaces an explicitly referenced preference without losing a neighboring hard field', () => {
    const quote = '颜色优先暖灰色，领型定为交领。前面提到的那个颜色别用';
    expect(read(`${quote}。交领照旧。`)).toMatchObject([
      { field: 'collar', op: 'eq', value: 'cross_open', level: 'hard', quote: '领型定为交领' },
      { field: 'color', op: 'neq', value: 'stone_gray', level: 'hard', quote },
    ]);
    expect(read('颜色偏好暖灰，配色也想要酒红。前面提到的那个颜色别用。')).not.toContainEqual(
      expect.objectContaining({ op: 'neq' }),
    );
    expect(read('颜色已经定了暖灰。前面提到的那个颜色别用。')).toMatchObject([
      { field: 'color', op: 'eq', value: 'stone_gray', level: 'hard' },
      { field: 'color', op: 'neq', value: 'stone_gray', level: 'hard' },
      { field: 'color', value: null, level: 'pending', blocking: true },
    ]);
    expect(read('优先用暖灰。先记录下单联系人。前面提到的颜色别用。')).not.toContainEqual(
      expect.objectContaining({ op: 'neq' }),
    );
  });

  it('keeps the unlisted color and its rejection in one verifiable span', () => {
    const quote = '上衣原本考虑红色，领型定为圆领。前面提到的那个颜色不要用';
    expect(read(`${quote}。圆领照旧。`, 'initial')).toMatchObject([
      { field: 'collar', value: null, level: 'pending', blocking: true, quote: '领型定为圆领' },
      { field: 'color', value: null, level: 'pending', blocking: true, quote, sourceTurnId: 'customer' },
    ]);
    const revision = '配色暂时考虑紫色，面料用真丝。刚才说的那个颜色别用';
    expect(read(`${revision}。`)).toContainEqual(expect.objectContaining({
      field: 'color', value: null, level: 'pending', blocking: true, quote: revision, sourceTurnId: 'customer',
    }));
  });

  it.each([
    '这套原本考虑红色或蓝色',
    '这套原先考虑蓝色，颜色优先藏青',
    '另一单原本考虑红色，这件领型定为圆领',
    '上次做的那件原本考虑红色',
    '上衣原本考虑红色。先记下交货时间',
  ])('does not attach unverified earlier colors to an exclusion after %s', (context) => {
    const rejection = '前面提到的那个颜色别用';
    const exclusions = read(`${context}。${rejection}。`, 'initial')
      .filter(({ field, op, blocking }) => field === 'color' && (op === 'neq' || blocking));
    expect(exclusions).toMatchObject([{ value: null, level: 'pending', blocking: true, quote: rejection }]);
  });

  it('reports open questions and prior intentions without turning them into active decisions', () => {
    expect(read('版师问要不要改成斜襟。店长问是否能把洗护改成送店干洗。')).toMatchObject([
      { field: 'collar', value: 'diagonal', level: 'preference', quote: '版师问要不要改成斜襟' },
      { field: 'care', value: 'dry_clean', level: 'preference', quote: '店长问是否能把洗护改成送店干洗' },
    ]);
    expect(read('原本想用绯红现在正式确认用藏青。')).toMatchObject([
      { field: 'color', value: 'navy', level: 'hard', quote: '现在正式确认用藏青' },
    ]);
    expect(read('版师问要不要把立领换洗后送去干洗。')).toEqual([]);
    expect(read('采购原先打算换回交领。现在讨论交期。')).toEqual([]);
    expect(read('采购原先打算换回交领。撤回这项调整。', 'initial')).toEqual([]);
  });

  it('preserves targeted removals and the new unresolved status of the same field', () => {
    expect(read('把刚加的现代风格限制删掉，也不用把新中式设成必选，风格看样再定。')).toMatchObject([
      { field: 'style', withdraws: { op: 'eq', value: 'modern' }, quote: '把刚加的现代风格限制删掉' },
      { field: 'style', withdraws: { op: 'eq', value: 'new_chinese' }, quote: '也不用把新中式设成必选' },
      { field: 'style', level: 'pending', quote: '风格看样再定' },
    ]);
  });
});
