import type { RequirementClause } from './requirementClauses';

export const REFERENCE_IMAGE = '(?:照片|图片|样图|效果图|参考图|剧照|样照|(?:试衣|试穿|排练|舞台|演出)照)';
export const UNMAPPED_COLOR = /[红蓝紫米橙黄粉绿白青深浅]色|宝蓝|靛蓝|天蓝|橄榄绿|荧光绿|芥末黄|柠檬黄|浅紫|紫红|桃粉|亮粉/;
export const CHOOSE_COLOR = /(?:用|选|做|订|要|定|定为|定在|定成|改成|改为|换成|换为|排除|避开|拒绝|按(?:着)?|照(?:着)?|就)(?:[这那](?:个|款|种))?\s*$/;

const COLOR_IMAGE = new RegExp(`${REFERENCE_IMAGE}|图(?:里|中|上)(?:面)?`);
const IMAGE_POINTER = /(?:(?:我|你|他|版师)?(?:发来?|给|拍)(?:过)?的)?(?:这张|那张|这幅|那幅|该)?\s*$/;
const IMAGE_COLOR_ADOPTION = /^(?:(?:就|也|只|必须|务必|一定(?:要|得)?)*\s*(?:用|选|定|采用|选用|做)|给(?:这件|这单|成衣|衣服|这件衣服)用)(?:了|吧|就好)?$/;

// A photo supplies an order color only when the customer directs its adoption or exclusion.
export function colorRequestPrefix(prefix: string, trailing: string, referenceArtifact: boolean, postposedDecision: boolean): string | null {
  const image = COLOR_IMAGE.exec(prefix);
  if (image) {
    const instruction = prefix.slice(0, image.index).replace(IMAGE_POINTER, '');
    if (CHOOSE_COLOR.test(instruction)) return instruction;
    return postposedDecision || IMAGE_COLOR_ADOPTION.test(trailing) ? prefix : null;
  }
  if ((referenceArtifact || COLOR_IMAGE.test(trailing)) && !CHOOSE_COLOR.test(prefix) && !postposedDecision) return null;
  return prefix;
}

const CONDITIONAL_LEAD = /^(?:若(?:是)?|如果|要是|假如|倘若|万一|假设)/;
const CONDITIONAL_CONSEQUENCE = /(?:就|才|则|便)(?:再|先|要|会|得|必须|不要|考虑|看|选|用|定|改)/;
const CONDITION_IN_STATEMENT = /只有.{1,30}才(?:会|能|考虑|用|选|订)|的话(?:就|才|则|便|用|要用|选|改)/;
const INDEPENDENT_DECISION = /^(?:现在|目前|最终|最后|现已|已经|正式)/;
const TENTATIVE_ACTION = /(?:可能|也许|或许|说不定|要不(?:就)?)(?:还|会|要|再|先)*\s*(?:看(?:看|一看|一下)?|考虑|定|选|用|试|做|换(?:成|为|用)?|改(?:成|为|用)?)?\s*$|(?:先|再|暂时)考虑(?:看看?|采用|选用|做|用|换成|改成)?\s*$|(?:留作|列为|放到|放在|当作|作为|暂列)\s*(?:候选|备选)\s*$/;
const CANDIDATE_COLOR = /^(?:也|先|暂时|暂且|仅|只)?(?:可作(?:为)?|可以(?:做|当)?|是|当|作(?:为)?|列(?:为|入)?)?(?:候选|备选)|^(?:也|还|暂时|暂且)?(?:可能|也许|或许)(?:再|先)?(?:看|考虑|用|选|定)|^(?:也|都|可以|可)?(?:再|随时|随便)(?:商量|讨论|谈谈)/;
const DECISION_AWAITED_BEFORE = /(?:等(?:待)?|待)[\p{Script=Han}]{0,10}(?:确认|签字|拍板|定下来|批准)(?:了)?(?:才能|才|再)(?:用|选|订|做|考虑)?\s*$/u;
const DECISION_AWAITED_AFTER = /^(?:待|尚待|有待|前提(?:是|得)|(?:还(?:得|需|要|需要)|得|需要)(?:再|先)?(?:等(?:待)?)?)(?:(?:负责人|经理|领导|客户|老板|采购)(?:先|再)?)?(?:签(?:字|核)|审批|批准|同意|拍板|确认)/;
const COLOR_QUESTION = /(?:是不是|是否|要不要|用不用|选不选|能不能|可不可以|能否|可否)(?:先|再|就|要)?(?:用|选|定|做|订|考虑)?\s*$/;
const ALTERNATIVE_LEAD = /^(?:或(?:者|是)?|也(?:可以?|能接受))/u;
const ALTERNATIVE_END = /(?:也(?:行|可以?|能接受)|都(?:行|可以?))(?:啊|吧|呢)?$/u;

const REPORTED_COLOR_QUESTION = /(?:说|问)(?:过|了)?[：:\s“‘「『]*(?:要不(?:就)?|(?:我|我们)?是不是(?:就)?(?:定|用|选)?|要不要(?:定|用|选)?|可不可以(?:定|用|选)?)\s*$/;
const FIRST_PERSON_COLOR_REQUEST = /^(?:(?:这次|这回|本次|本单|这件|这套|成衣|衣服)的?\s*)?(?:颜色|色系|色彩|色调|配色|主色)(?:上|方面)?[：:]?\s*我(?:们)?(?:本人|这边)?\s*(?:(?:这次|这回|本次|本单|这件|这套)\s*)?想要(?:用|选)?\s*$/u;
const REPORTING_LEAD = /(?:说|提到|表示|留言|回复|问)(?:过|了)?[：:\s]*$/u;
const CHOICE_QUALIFIER = /^(?:还是|除非|前提(?:是|得)|.{1,24}的话(?:再|就|才|则|便))/u;
const SOFT_CHOICE_CONTINUATION = /^[，,。；;\s]*(?:(?:但(?:是)?|不过|然而)[ \t]*)?(?:这(?:个)?(?:颜色|配色)?|颜色|配色|定色|它)?[ \t]*(?:只是|只算)?(?:(?:个人)?偏好|初步(?:考虑|想法)|暂(?:时)?(?:作为?|当作)参考|还(?:没|未)(?:定色?|决定)|不强求)(?:了|吧|呢)?(?=$|[，,。；;！？!?\s])/u;
const APPROVAL_COLOR_TOPIC = /^(?:(?:这个|这次|本单的?)(?:色|颜色|配色)|颜色|配色|定色|这(?:个|色))\s*/u;
const APPROVAL_COLOR_END = /^(?:了|才(?:能|会)?定色|这(?:个|款)色|这个颜色|颜色|配色)?$/u;

// Require a color topic and a single color object for this first-person construction.
export function isDirectColorChoice(clause: string, start: number, end: number): boolean {
  return FIRST_PERSON_COLOR_REQUEST.test(clause.slice(0, start)) && /^色?\s*$/u.test(clause.slice(end));
}

// An adjacent approval can qualify a color choice and extend its evidence across clauses.
export function directColorChoiceContinuation(text: string, previous: RequirementClause | undefined,
  current: RequirementClause, next: RequirementClause | undefined, namesColor: (text: string) => boolean): string | null {
  if (!current.text.includes('想要')) return null;
  const before = text.slice(0, current.start);
  if (/[“‘「『][^”’」』]*$/u.test(before) || (before.match(/"/gu)?.length ?? 0) % 2) return null;
  if (previous && /^[，,:：\s]+$/u.test(text.slice(previous.end, current.start)) && REPORTING_LEAD.test(previous.text)) return null;
  const after = text.slice(current.end, next?.start);
  if (/^\s*[？?]/u.test(after)) return null;
  if (!next || /\r?\n[ \t]*\r?\n/u.test(after)) return '';
  if (SOFT_CHOICE_CONTINUATION.test(text.slice(current.end))) return null;
  const qualifier = next.text.replace(/^(?:不过|然而)\s*/u, '');
  const continued = qualifier !== next.text || /但(?:是)?\s*$/u.test(after) || /^[，,\s]+$/u.test(after);
  const decision = qualifier.replace(APPROVAL_COLOR_TOPIC, '');
  const awaiting = DECISION_AWAITED_AFTER.exec(decision);
  if (awaiting && (continued || /^[。；;.\s]+$/u.test(after)) && APPROVAL_COLOR_END.test(decision.slice(awaiting[0].length))) {
    return text.slice(current.end, next.end);
  }
  if (!continued) return '';
  const alternative = (ALTERNATIVE_LEAD.test(qualifier) || ALTERNATIVE_END.test(qualifier)) && namesColor(qualifier);
  return CONDITIONAL_LEAD.test(qualifier) || alternative || CHOICE_QUALIFIER.test(qualifier) ? null : '';
}

export function reportsColorQuestion(prefix: string): boolean {
  return REPORTED_COLOR_QUESTION.test(prefix);
}

export function isUnsettledColor(clause: string, prefix: string, trailing: string, followsCondition: boolean, confirmed: boolean): boolean {
  if (CONDITIONAL_LEAD.test(prefix) || CONDITIONAL_LEAD.test(clause) && !INDEPENDENT_DECISION.test(prefix) ||
    CONDITION_IN_STATEMENT.test(prefix + trailing) || DECISION_AWAITED_BEFORE.test(prefix)) return true;
  if (followsCondition && !confirmed && !INDEPENDENT_DECISION.test(prefix)) return true;
  return !confirmed && (TENTATIVE_ACTION.test(prefix) || CANDIDATE_COLOR.test(trailing) ||
    DECISION_AWAITED_AFTER.test(trailing) || COLOR_QUESTION.test(prefix) || ALTERNATIVE_LEAD.test(prefix));
}

export function colorConditionBefore(text: string, previous: RequirementClause | undefined, current: RequirementClause): string {
  if (!previous || !/^[，,\s]+$/u.test(text.slice(previous.end, current.start))) return '';
  const { text: condition } = previous;
  if ((!CONDITIONAL_LEAD.test(condition) && !/的话$/.test(condition)) || CONDITIONAL_CONSEQUENCE.test(condition)) return '';
  return text.slice(previous.start, current.start);
}
