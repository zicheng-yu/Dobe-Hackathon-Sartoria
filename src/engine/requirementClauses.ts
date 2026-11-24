// Preserve offsets so every extracted fact can point to the customer's original text.
export interface RequirementClause {
  text: string;
  start: number;
  end: number;
}

export const REJECTION_PREDICATE = /(?:请)?(?:别(?:再)?(?:做|用|拿来|选|留|上|加|考虑)|不要(?:再)?(?:做|用|拿来|选|留|考虑)?|不能(?:做|用|选)|不(?:用|选|做|考虑|接受)|排除|排掉|剔除)(?:了|吧|就行)?$/.source;
export const PAIRED_REJECTION = new RegExp(`^(?:(?:这|那)?(?:两|二|2|２)(?:个|款|种|样|项|件|条|套)|两者|二者)\\s*(?:全都|都|一律|统统|全部)\\s*${REJECTION_PREDICATE}`);

const newOrderTopic = /^(?:换个话题|说回这(?:一)?单|再说另一单|再说下一单|另(?:一单|一笔订单)|下一(?:单|件要做的衣服))/u;
const startsGarmentOrder = /^(?:(?:这次|现在|另外|我(?:们)?(?:要|想)?)\s*)*(?:[订定]做?|制作|做|需要|想要)[^，,。；;！？!?]{0,24}(?:外套|上衣|套装|西装|西服|夹克|裙|裤|工装|礼服|制服)/u;

// Only switch the working order when the customer both changes topic and starts a new garment order.
// The complete message remains in the turn history.
export function activeOrderClauses(clauses: RequirementClause[]): RequirementClause[] {
  for (let i = clauses.length - 1; i >= 0; i--) {
    const topic = newOrderTopic.exec(clauses[i].text);
    if (!topic) continue;
    const remainder = clauses[i].text.slice(topic[0].length).trim();
    if (startsGarmentOrder.test(remainder || clauses[i + 1]?.text || '')) return clauses.slice(remainder ? i : i + 1);
  }
  return clauses;
}

const clauseBoundary = /[，,；;。！？!?\n]+|(?<!不)但(?:是)?|另外|而且|同时|只是(?!\s*(?:参考|对照|示意|备选|候选))|并且|并(?=把|将|改|换|只|要)|随后|却|、(?=(?:不要|要用|只要|还要|不能|必须|最好|希望|洗护|面料|色系|颜色|工艺|领型|套数|数量))|(?<=不动|不变|照旧|待定|不强求|原计划|原方案|原单)(?=只|改|换|想|请|调整|色系|颜色|洗护|可机洗|必须)|[^\S\r\n]+/gu;
const unfinishedPhrase = /(?:必须|务必|只能|不能|不许|不接受|不允许|不考虑|不得|不要|别用|排除|需要|最好|优先|希望|想要|倾向|确定|确认为|改成|换成|定为|定在|按|为|在|选|用|做|给|订|和|或|与|的|是|比|别|不)$/u;
const unitAfterNumber = /^(?:套|件|身|条|份|人|位|名|个|成|厘米|毫米|公分|%|％|cm\b|mm\b)/iu;
const trailingStance = /^(?:(?:我|我们|采购|后勤)(?:这边|本人)?\s*)?(?:一律|也|都|明确|完全|坚决|暂时|先)*\s*(?:排除|不接受|不要|别用|不用|为准|照旧|待定|优先|不能用)(?=[\s，,。；;！？!?]|$)/u;
const nextFieldStatement = /^[\p{Script=Han}]{1,10}(?:必须|务必|只能|改成|定为|已(?:经)?(?:签|定)|是(?:我|我们|采购|客户)|(?:一律|也|都|明确)(?:排除|不接受|不要|不用))/u;
const outstandingDecision = /^[\p{Script=Han}]{1,8}(?:还没|还未|尚未)(?:给|提供|决定|确认|发|签|核)/u;

function isSpokenBreak(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (PAIRED_REJECTION.test(left.trim()) && /^(?:面料|主料|材质|颜色|配色|领型|数量|洗护|款式|裙长|衣长)/u.test(right)) return true;
  if (/的$/u.test(left) && /^(?:(?:也|又|还)(?:必须|一定|不能|不得)|肯定不是|绝对不能)/u.test(right)) return true;
  if (unfinishedPhrase.test(left) && !(
    /(?:都|也|一律|明确|坚决)(?:明确)?(?:排除|不要|不接受|不用)$/u.test(left) &&
    nextFieldStatement.test(right)
  )) return false;
  if (/[\d０-９零〇一二两三四五六七八九十百千万]$/u.test(left) && unitAfterNumber.test(right)) return false;
  if (/^(?:的|或(?:者)?|和|与|及)(?:\s|[，。；！？]|$)/u.test(right) || trailingStance.test(right)) return false;
  if (/[A-Za-zＡ-Ｚａ-ｚ０-９0-9]$/u.test(left) && /^(?:[A-Za-z０-９0-9型版形]|一样|那样)/u.test(right)) return false;
  // A space between grammatical words (such as “颜色 暖灰”) is weaker than a clause ending.
  return /\p{Script=Han}/u.test(left) && /^[\p{Script=Han}]/u.test(right) &&
    (left.trim().length >= 3 || left.trim().length >= 2 && outstandingDecision.test(right));
}

export function splitRequirementClauses(text: string): RequirementClause[] {
  const clauses: RequirementClause[] = [];
  let start = 0;
  function append(end: number) {
    const source = text.slice(start, end);
    const value = source.trim();
    if (!value) return;
    const offset = start + source.indexOf(value);
    clauses.push({ text: value, start: offset, end: offset + value.length });
  }
  for (const boundary of text.matchAll(clauseBoundary)) {
    const next = boundary.index + boundary[0].length;
    if (/^[^\S\r\n]+$/u.test(boundary[0]) &&
      !isSpokenBreak(text.slice(start, boundary.index), text.slice(next))) continue;
    append(boundary.index);
    start = next;
  }
  append(text.length);
  return clauses;
}
