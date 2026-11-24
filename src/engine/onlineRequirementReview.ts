import type { ConstraintField, DecisionRequirement } from '../types/decisions';
import type { DeconstructedRequirement } from '../types/sartoria';
import { BATCH_QUANTITY_SCOPE, quantityScopeOf, TOTAL_QUANTITY_SCOPE } from './requirementQuantity';

const reviewTopics: Partial<Record<ConstraintField, RegExp>> = {
  businessType: /委托|团订|团体定制|个人定制/,
  quantity: /数量|件数|套数|订量|总量|(?:订|做|配|要|定)(?:几(?:套|件|身|条)|多少)/,
  scene: /场地|场合|场景|地点|场馆/,
  season: /季节|季候|春季|夏季|秋季|冬季/,
  category: /成衣品类|服装品类/,
  patternStructure: /版型|廓形|两件式/,
  collar: /领型|领口/,
  fabric: /材质|面料(?:成分|种类|选型)|主料/,
  color: /色系|色彩|色号|颜色|配色|色卡/,
  motif: /纹样|图案|提花/,
  lengthRatio: /衣长|裙长|下摆长度/,
  easeAllowance: /松量|活动余量|放量/,
  closure: /扣合|纽扣|门襟/,
  care: /洗护|养护|清洗|机洗|干洗|手洗/,
  wrinkleResistance: /抗皱|耐皱/,
  luster: /光泽|反光|哑光/,
  style: /风格/,
  craft: /工艺|刺绣|盘扣/,
};
const topics = Object.entries(reviewTopics) as [ConstraintField, RegExp][];
const independentReview = /尺码|花名册|名单|人数|(?:各|分别)(?:自|款|组|岗|做|订|配|多少)|男女|分配|剩余|余单|尾单|后续批|样衣|试穿|试身|量体|实物色卡|样布|洗标|(?:交|送|到)货|时间|日期|档期/;

export function applyOnlineRequirementReview(
  requirement: DecisionRequirement,
  presentation?: DeconstructedRequirement,
): DecisionRequirement {
  const source = presentation?.engineUsed === 'llm_api' ? {
    notes: presentation.threeBuckets.needsHumanVerification,
    questions: presentation.followUpQuestions ?? [],
  } : requirement.onlineReview;
  if (!source) return requirement;
  const confirmations = requirement.constraints.filter((item) => item.state === 'confirmed' && item.op === 'eq');
  const confirmed = new Set(confirmations.filter((item) =>
    !requirement.constraints.some((other) => other.field === item.field && other.level === 'pending')).map(({ field }) => field));
  const quantities = new Set(confirmations.filter((item) => item.field === 'quantity' && typeof item.value === 'number').map(quantityScopeOf));
  const key = (text: string) => text.replace(/[\s，,。；;：:！!？?]/gu, '');
  const typedQuestions = new Set(requirement.questions.map(({ question }) => key(question)));
  // Human confirmation resolves a matching field question. Production details and other work still need review.
  const keep = (line: string) => {
    if (independentReview.test(line)) return true;
    const matchingFields = topics.filter(([, expression]) => expression.test(line));
    return !matchingFields.length || !matchingFields.every(([field]) => {
      if (field !== 'quantity') return confirmed.has(field);
      const batch = BATCH_QUANTITY_SCOPE.test(line);
      const total = TOTAL_QUANTITY_SCOPE.test(line);
      return batch ? quantities.has('batch') && (!total || quantities.has('order')) : quantities.has('order');
    });
  };
  const unique = (lines: string[]) => [...new Map(lines.map((line) => [key(line), line.trim()])).entries()]
    .filter(([lineKey]) => lineKey.length > 0).map(([, line]) => line);
  const notes = unique(source.notes).filter(keep);
  const noteKeys = new Set(notes.map(key));
  const questions = unique(source.questions).filter((line) => !noteKeys.has(key(line)) && !typedQuestions.has(key(line)) && keep(line));
  return { ...requirement, onlineReview: notes.length || questions.length ? { notes, questions } : undefined };
}
