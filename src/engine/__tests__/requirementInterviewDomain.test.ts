import { describe, expect, it } from 'vitest';
import { extractRevisionConstraints } from '../requirementInterview';

const readOrder = (text: string) => extractRevisionConstraints({ id: 'customer', text }, 'initial');

describe('garment order language', () => {
  it('reads a staff order and keeps the composition of a suit separate from its quantity', () => {
    const constraints = readOrder('给场馆负责引导的同事统一做24套西装。上衣西裤要做分开的两件。布料选哑面的。');
    expect(constraints).toMatchObject([
      { field: 'businessType', op: 'eq', value: 'corporate_uniform', level: 'hard' },
      { field: 'quantity', op: 'eq', value: 24, level: 'hard' },
      { field: 'category', op: 'eq', value: 'suit', level: 'hard' },
      { field: 'patternStructure', op: 'eq', value: 'two_piece', level: 'hard', quote: '上衣西裤要做分开的两件' },
      { field: 'luster', op: 'eq', value: 'low', level: 'hard' },
    ]);
  });

  it('recognizes personal tailoring, a formal award event, hem position and an unpatterned fabric', () => {
    const constraints = readOrder('为我妈量体订做一件夹克。她在学校礼堂上台受奖。下摆齐屁股中部。布面不能织任何纹样。');
    expect(constraints).toMatchObject([
      { field: 'businessType', op: 'eq', value: 'private_couture', level: 'hard' },
      { field: 'quantity', op: 'eq', value: 1, level: 'hard' },
      { field: 'scene', op: 'eq', value: 'indoor_formal', level: 'hard' },
      { field: 'category', op: 'eq', value: 'jacket', level: 'hard' },
      { field: 'motif', op: 'eq', value: 'plain', level: 'hard', quote: '布面不能织任何纹样', sourceTurnId: 'customer' },
      { field: 'lengthRatio', op: 'eq', value: 'mid_hip', level: 'hard', quote: '下摆齐屁股中部' },
    ]);
  });

  it('recognizes fit and wrinkle requirements expressed as garment behavior', () => {
    const constraints = readOrder('衣身从肩线起一直直着往下走。领口要稍微竖起来。手臂得能自由抬高。坐一会儿别留下满身褶子。');
    expect(constraints).toMatchObject([
      { field: 'patternStructure', op: 'eq', value: 'h_line', level: 'hard', quote: '衣身从肩线起一直直着往下走' },
      { field: 'collar', op: 'eq', value: 'stand', level: 'hard', quote: '领口要稍微竖起来' },
      { field: 'easeAllowance', op: 'eq', value: 'arm_mobility', level: 'hard' },
      { field: 'wrinkleResistance', op: 'eq', value: true, level: 'hard' },
    ]);
  });

  it('reads room for raising a hand in the sleeve description', () => {
    expect(readOrder('袖子得方便抬手。')).toMatchObject([
      { field: 'easeAllowance', op: 'eq', value: 'arm_mobility', level: 'hard', quote: '袖子得方便抬手' },
    ]);
    expect(readOrder('衣袖最好便于举臂。')).toMatchObject([
      { field: 'easeAllowance', op: 'eq', value: 'arm_mobility', level: 'preference' },
    ]);
    expect(readOrder('旧样的衣袖不方便抬手。').some(({ field }) => field === 'easeAllowance')).toBe(false);
  });

  it('counts separate bookings when the wearers are given and leaves an allocation alone open', () => {
    const text = '我们三个各自来订一身。上装和半身裙得各自独立制作。';
    expect(readOrder(text)).toMatchObject([
      { field: 'businessType', op: 'eq', value: 'private_couture', level: 'hard' },
      { field: 'quantity', op: 'eq', value: 3, level: 'hard', quote: '我们三个各自来订一身' },
      { field: 'category', op: 'eq', value: 'two_piece', level: 'hard' },
      { field: 'patternStructure', op: 'eq', value: 'two_piece', level: 'hard' },
    ]);
    expect(readOrder('各自来订一身。每套由两件成衣组成。').some(({ field }) => field === 'quantity')).toBe(false);
  });

  it('keeps an explicit outfit designation following the component description', () => {
    const constraints = readOrder('想要上装和半身裙分开的两件式舞台服。');
    expect(constraints).toMatchObject([
      { field: 'category', op: 'eq', value: 'two_piece', level: 'hard' },
      { field: 'patternStructure', op: 'eq', value: 'two_piece', level: 'hard' },
    ]);
  });

  it('recognizes the one-piece dress classifier and the paired color as one requirement', () => {
    const constraints = readOrder('我打算照自己的尺码做一条连身裙。颜色用象牙白搭配玫瑰粉。');
    expect(constraints).toMatchObject([
      { field: 'businessType', op: 'eq', value: 'private_couture', level: 'hard' },
      { field: 'quantity', op: 'eq', value: 1, level: 'hard' },
      { field: 'category', op: 'eq', value: 'dress', level: 'hard' },
      { field: 'color', op: 'eq', value: 'ivory_rose', level: 'hard' },
    ]);
  });

  it('retains the polarity and firmness of new aliases', () => {
    const constraints = readOrder('不要矮立领。别用反光非常强的料子。最好用亚光。颜色希望用米白配上玫瑰粉。');
    expect(constraints).toMatchObject([
      { field: 'collar', op: 'neq', value: 'stand', level: 'hard' },
      { field: 'color', op: 'eq', value: 'ivory_rose', level: 'preference' },
      { field: 'luster', op: 'neq', value: 'high', level: 'hard' },
      { field: 'luster', op: 'eq', value: 'low', level: 'preference' },
    ]);
  });

  it('does not infer a structure, formal event or plain fabric from unrelated restrictions', () => {
    const constraints = readOrder('上衣和裤子分开清洗。只是去礼堂排练。布面别织花鸟图案。');
    expect(constraints.some(({ field, value }) => value !== null &&
      ['patternStructure', 'scene', 'motif', 'quantity'].includes(field))).toBe(false);
  });

  it('does not infer a private order from a group fitting or from rejected self-measurement', () => {
    const constraints = readOrder('给员工订三套工服。员工照自己的尺码量。我不打算照自己的尺寸做。');
    expect(constraints.filter(({ field }) => field === 'businessType')).toMatchObject([
      { op: 'eq', value: 'corporate_uniform', level: 'hard' },
    ]);
  });
});
