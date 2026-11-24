import type { Constraint } from '../types/decisions';

const ARABIC_DIGITS = '0-9０-９';
const CHINESE_NUMERALS = '零〇一二两三四五六七八九十百千万';
const DIGITS = ARABIC_DIGITS + CHINESE_NUMERALS;
const NUMBER = `(?:[${ARABIC_DIGITS}]+|[${CHINESE_NUMERALS}]+)`;
const COUNT_START = `(?<![第.${DIGITS}])`;
const GARMENT_NOUN = '(?:外套|夹克|上衣|西服|西装|礼服|礼裙|长裙|连(?:衣|身)(?:裙|礼服)|裙子|裙装|衣服|演出服|成衣|套装)';
// A garment noun may follow a brief modifier, such as the intended occasion or style.
export const GARMENT_AFTER_CLASSIFIER = `(?!事|要求|意见|建议|信息|规定|规则|理由|备注|说明|反馈|(?:洗护|养护|交付|工艺|安全)(?:的)?(?:要求|建议|说明|规则))[:：]?(?=[^，,；;。！？!?、:：\\d]{0,12}${GARMENT_NOUN})`;
const DOCUMENT_AFTER_PORTION = '(?![^，,；;。！？!?、]{0,4}(?:文件|单据|合同|报表|统计|清单|记录|报价|说明|方案|报告|协议))';
// 件装 can describe pack size; 装饰 following a classifier describes the garment instead.
const ORDER_UNIT = `(?:套(?:装)?|件|身|(?:份${DOCUMENT_AFTER_PORTION}|条)${GARMENT_AFTER_CLASSIFIER})(?![式套]|装(?!饰))`;
const QUANTITY = new RegExp(`${COUNT_START}(${NUMBER})\\s*(${ORDER_UNIT})`, 'g');
const SINGLE_GARMENT = new RegExp(`(?:做|订|定做|订制|定制)\\s*([件条])(?![式套])${GARMENT_AFTER_CLASSIFIER}`);
const PERSON_ROLE = '(?:员工|同事|职工|职员|工作人员|接待人员|礼宾人员|技术人员|成员|队员|老师|学生|演员|志愿者|售货员|店员|导购|服务员|组员)';
const ALLOCATION_ACTOR = `(?:每(?:一)?(?:人|位|名|个(?:人)?)(?:\\s*${PERSON_ROLE})?|人[均手]|一(?:人|位)|各(?:人|自)?)`;
const PERSON_COUNT = new RegExp(`${COUNT_START}(${NUMBER})\\s*(?:个人|人(?!均|手)|名|位|个(?=${PERSON_ROLE}|[，,；;\\s]*${ALLOCATION_ACTOR}))`, 'g');
const ALLOCATION_ACTION = '(?:\\s|都|也|只|要|得|是|先|来|统一|分别|单独|量身|量体|配(?:发|备|给)?|发(?:放|给)?|领(?:取|用)?|拿|分(?:到|发)?|订(?:做|制)?|定(?:做|制)?|做|备|给|选(?:择)?)';
const UNCERTAIN_LEAD = '(?:大约|约(?:有|为)?|大概|差不多|至少|至多|最多|最少|不[超多]过|不[少低]于|超过|不足)';
const OPTIONAL_ALLOCATION = `(?:${UNCERTAIN_LEAD}|可(?:以)?|可能|尽量|希望|优先|预计|暂定)`;
const ALLOCATION_LEAD = `${ALLOCATION_ACTOR}((?:${ALLOCATION_ACTION}|${OPTIONAL_ALLOCATION}){0,7})`;
const UNCERTAIN_END = '(?:左右|上下|余|多(?=\\s|[，,；;。！？!?]|$)|以上|以下|起(?![床身头]))';
const COUNT_RANGE = '(?:到|至|[-－—~～])';
const ALLOCATION = new RegExp(
  `${ALLOCATION_LEAD}(${NUMBER})(?:(?:${ORDER_UNIT})?\\s*(${COUNT_RANGE})\\s*${NUMBER})?\\s*(${ORDER_UNIT})(${UNCERTAIN_END})?`,
  'g',
);
const SINGLE_ALLOCATION = new RegExp(`${ALLOCATION_LEAD}[件条](?![式套])${GARMENT_AFTER_CLASSIFIER}`, 'g');
const UNCERTAIN_HEADCOUNT = new RegExp(`(?:${UNCERTAIN_LEAD}|${NUMBER}\\s*${COUNT_RANGE})\\s*$`);
const uncertainAllocation = new RegExp(OPTIONAL_ALLOCATION);
const ROSTER_SUFFIX = new RegExp(`^(?:\\s|的|在岗|到岗|参加|出席|${PERSON_ROLE}|，|,|；|;)*$`);
const LABEL_JOINER = '\\s*(?:合计|共计|是|为|共|[:：=])?\\s*';
const QUANTITY_LABEL = `(套数|件数|订购数量|定制数量|数量)${LABEL_JOINER}`;
const LABELED_QUANTITY = new RegExp(`${QUANTITY_LABEL}(${NUMBER})(?!\\s*(?:套|件|身|份|条|人|位|名|个|[.${DIGITS}]))`, 'g');
const ALLOCATION_SUBJECT = `${ALLOCATION_ACTOR}(?:的|配发|领用)*\\s*`;
const PEOPLE_SUBJECT = `(?:${PERSON_ROLE}|人员|穿着者|着装人|观众|参与者|受众)(?:的|总|实际|预计)*\\s*`;
const ALLOCATION_QUANTITY_LABEL = new RegExp(`${ALLOCATION_SUBJECT}$`);
const PEOPLE_QUANTITY_LABEL = new RegExp(`${PEOPLE_SUBJECT}$`);
const NON_ORDER_LABELED_COUNT = new RegExp(`(?:${ALLOCATION_SUBJECT}${QUANTITY_LABEL}|${PEOPLE_SUBJECT}数量${LABEL_JOINER})$`);
const PIECES_PER_SET = /每(?:一)?(?:套|身)(?:里|内)?(?:共|有|含|包含|包括|由|分成|分为|是|做|配|用|要)*\s*$/;
const TWO_PIECE_AFTER_CLASSIFIER = /^\s*(?:两|二|2|２)件(?:式|套|装)/;
const SAMPLE_PREFIX = /(?:样衣|样品|试样|打样)(?:只|先|共|要|做|定|订|出|打|送|给|准备|数量|是|为|[:：]|\s){0,10}$/u;
const SAMPLE_SUFFIX = /^\s*(?:试穿用的?)?(?:样衣|样品|试样)(?:$|[^面布领袖裙摆腰线工])/u;
const TENTATIVE_COUNT_PREFIX = /(?:暂(?:定|估|报)|预估|估计|预计|可能|约莫|约有|不超过|不少于)\s*(?:为|有|是|按|做|定|订|报|要|在|[:：]|\s){0,10}$/u;
const TENTATIVE_COUNT_SUFFIX = /^\s*(?:左右|上下|区间|以上|以下|或更多|或更少)/u;

export type QuantityScope = 'order' | 'batch';
export const TOTAL_QUANTITY_SCOPE = /整单|全单|所有批次|累计|总(?:订量|数量|量|计|套数|件数)/;
export const BATCH_QUANTITY_SCOPE = /首批|第[一1１]批|(?:这(?:一)?|本|该)批(?:次)?/;
const SCOPE_TAIL = `(?:(?!${NUMBER}\\s*${ORDER_UNIT})[^，,；;。！？!?\\n]){0,20}$`;
const WHOLE_ORDER_PREFIX = new RegExp(`(?:整单|全单|所有批次)${SCOPE_TAIL}`, 'u');
const TOTAL_PREFIX = new RegExp(`(?:${TOTAL_QUANTITY_SCOPE.source})${SCOPE_TAIL}`, 'u');
const BATCH_PREFIX = new RegExp(`(?:${BATCH_QUANTITY_SCOPE.source})${SCOPE_TAIL}`, 'u');
const BATCH_SUFFIX = new RegExp(
  `^\\s*(?:(?:是|为|作为|放在)(?:${BATCH_QUANTITY_SCOPE.source})|(?:${BATCH_QUANTITY_SCOPE.source})(?=$|[的，,；;。！？!?]|订量|订单|成衣))`,
  'u',
);
const FIRST_ORDER_ACTION = new RegExp(
  `先(?:行)?(?:安排(?:先)?(?:下单|订购|定制|做|生产|交付)?|下(?:单|订)?|定(?:下|制|做)?|订(?:购|做|制)?|做|配(?:发)?|生产|交(?:付)?)(?:${GARMENT_NOUN}|工服|工作服|职业服|制服)?(?:订单)?(?:\\s|[:：=]|共|计|为|${UNCERTAIN_LEAD})*$`,
  'u',
);
const PROCEDURAL_FOLLOWUP = /^[^，,；;。！？!?\n]{0,12}(?:之后|以后|后再|再|然后|随后)(?:进行)?(?:验收|验货|质检|检验|试穿|检查|确认|熨烫|打包|发货|交付|交货)/u;

export function namedQuantityScope(text: string): QuantityScope | undefined {
  const total = TOTAL_QUANTITY_SCOPE.test(text);
  const batch = BATCH_QUANTITY_SCOPE.test(text);
  return total === batch ? undefined : batch ? 'batch' : 'order';
}

export function isBatchQuantity(text: string, start: number, end: number): boolean {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const batch = before.match(BATCH_PREFIX);
  const wholeOrder = before.match(WHOLE_ORDER_PREFIX);
  if (batch) return !wholeOrder || batch.index! > wholeOrder.index!;
  if (TOTAL_PREFIX.test(before)) return false;
  return BATCH_SUFFIX.test(after) || FIRST_ORDER_ACTION.test(before) && !PROCEDURAL_FOLLOWUP.test(after);
}

export function isSampleQuantity(text: string, start: number, end: number): boolean {
  return SAMPLE_PREFIX.test(text.slice(0, start)) || SAMPLE_SUFFIX.test(text.slice(end));
}

export function isTentativeQuantity(text: string, start: number, end: number): boolean {
  return TENTATIVE_COUNT_PREFIX.test(text.slice(0, start)) || TENTATIVE_COUNT_SUFFIX.test(text.slice(end));
}

interface QuantityMatch {
  value: number;
  start: number;
  end: number;
  unit: string;
}

function parseQuantity(text: string): number {
  const halfWidth = text.normalize('NFKC');
  if (/^[0-9]+$/.test(halfWidth)) return Number(halfWidth);
  const digits = '零一二三四五六七八九';
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let section = 0;
  let current = 0;
  for (const character of text) {
    if (character === '万') {
      total += (section + current) * 10000;
      section = current = 0;
      continue;
    }
    const unit = units[character];
    if (unit) {
      section += (current || 1) * unit;
      current = 0;
    } else {
      const digit = character === '两' ? 2 : character === '〇' ? 0 : digits.indexOf(character);
      current = current * 10 + digit;
    }
  }
  return total + section + current;
}

function isPositiveCount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function matchPerPersonQuantity(text: string): QuantityMatch | undefined {
  const people = [...text.matchAll(PERSON_COUNT)];
  for (const allocation of text.matchAll(ALLOCATION)) {
    if (uncertainAllocation.test(allocation[1]) || allocation[3] || allocation[5]) continue;
    const headcount = people.findLast((match) => {
      const end = match.index + match[0].length;
      return end <= allocation.index && ROSTER_SUFFIX.test(text.slice(end, allocation.index));
    });
    if (!headcount || UNCERTAIN_HEADCOUNT.test(text.slice(0, headcount.index))) continue;
    const peopleCount = parseQuantity(headcount[1]);
    const perPerson = parseQuantity(allocation[2]);
    const total = peopleCount * perPerson;
    if (isPositiveCount(peopleCount) && isPositiveCount(perPerson) && isPositiveCount(total)) {
      return { value: total, start: headcount.index, end: allocation.index + allocation[0].length, unit: allocation[4][0] };
    }
  }
}

export function matchOrderQuantities(text: string, twoPiece: boolean): QuantityMatch[] {
  const crew = matchPerPersonQuantity(text);
  for (const labeled of text.matchAll(LABELED_QUANTITY)) {
    const prefix = text.slice(0, labeled.index);
    if (ALLOCATION_QUANTITY_LABEL.test(prefix) || labeled[1] === '数量' && PEOPLE_QUANTITY_LABEL.test(prefix)) continue;
    const value = parseQuantity(labeled[2]);
    if (!isPositiveCount(value)) continue;
    const unit = labeled[1] === '套数' || labeled[1] === '件数' ? labeled[1][0] : '';
    const stated = { value, start: labeled.index, end: labeled.index + labeled[0].length, unit };
    return crew ? [crew, stated] : [stated];
  }

  // An allocation describes each wearer's share. It needs a separate headcount to yield a total.
  const allocations = [...text.matchAll(ALLOCATION)];
  const quantities = [...text.matchAll(QUANTITY)].flatMap((match): QuantityMatch[] => {
    const end = match.index + match[0].length;
    if (allocations.some((allocation) => allocation.index <= match.index && allocation.index + allocation[0].length >= end)) return [];
    const prefix = text.slice(0, match.index);
    if (PIECES_PER_SET.test(prefix) || NON_ORDER_LABELED_COUNT.test(prefix)) return [];
    if (/件\s*(?:内搭|里衬|衬里|打底衫)/.test(text.slice(match.index, end + 4))) return [];
    const value = parseQuantity(match[1]);
    return isPositiveCount(value) ? [{ value, start: match.index, end, unit: match[2][0] }] : [];
  });
  const single = SINGLE_GARMENT.exec(text);
  const singleIsAllocation = single && [...text.matchAll(SINGLE_ALLOCATION)].some((allocation) =>
    allocation.index <= single.index && allocation.index + allocation[0].length >= single.index + single[0].length);
  if (!crew && !quantities.length && single && !singleIsAllocation) {
    quantities.push({ value: 1, start: single.index, end: single.index + single[0].length, unit: single[1] });
  }

  // Piece counts within an outfit describe its construction.
  const orderCounts = twoPiece ? quantities.filter(({ end, unit }) =>
    unit !== '件' || TWO_PIECE_AFTER_CLASSIFIER.test(text.slice(end))) : quantities;
  return crew ? [crew, ...orderCounts] : orderCounts;
}

export function quantityScopeFromQuote(value: number, source?: string | null): QuantityScope {
  return source && matchOrderQuantities(source, false).some(({ value: count, start, end }) =>
    count === value && isBatchQuantity(source, start, end)) ? 'batch' : 'order';
}

export function quantityScopeOf(item: Pick<Constraint, 'value'> & Partial<Pick<Constraint, 'quote' | 'quantityScope'>>): QuantityScope {
  return item.quantityScope ?? (typeof item.value === 'number'
    ? quantityScopeFromQuote(item.value, item.quote)
    : namedQuantityScope(item.quote ?? '') ?? 'order');
}

export function orderQuantityUnit(value: number, source: string, scope: QuantityScope): string | undefined {
  const quantities = matchOrderQuantities(source, false).filter(({ value: count }) => count === value);
  const scoped = quantities.filter(({ start, end }) => isBatchQuantity(source, start, end) === (scope === 'batch'));
  const units = new Set((scoped.length ? scoped : quantities).map(({ unit }) => unit));
  return units.size === 1 ? units.values().next().value : undefined;
}

export function describeOrderQuantity(value: number, source?: string | null, scope?: QuantityScope): string {
  const orderScope = scope ?? quantityScopeFromQuote(value, source);
  const unit = source ? orderQuantityUnit(value, source, orderScope) : undefined;
  return `${orderScope === 'batch' ? '本批 ' : ''}${value}${unit ? ` ${unit}` : ''}`;
}

export function parseFormQuantity(text: string): number {
  const match = text.matchAll(QUANTITY).next().value;
  const count = match ? parseQuantity(match[1]) : 0;
  return isPositiveCount(count) ? count : 0;
}
