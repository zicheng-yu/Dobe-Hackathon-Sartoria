import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { SCENES, sceneFits } from '../data/scenes';
import { activeOrderClauses, PAIRED_REJECTION, REJECTION_PREDICATE, splitRequirementClauses, type RequirementClause } from './requirementClauses';
import {
  CHOOSE_COLOR, colorConditionBefore, colorRequestPrefix, directColorChoiceContinuation, isDirectColorChoice,
  isUnsettledColor, REFERENCE_IMAGE, reportsColorQuestion, UNMAPPED_COLOR,
} from './requirementColorScope';
import { unmappedGarmentTerm } from './unmappedGarment';
import { excludesVenue, namesStageSubject, stageLocations } from './stageLocation';
import {
  BATCH_QUANTITY_SCOPE, describeOrderQuantity, GARMENT_AFTER_CLASSIFIER, isBatchQuantity, isSampleQuantity,
  isTentativeQuantity, matchOrderQuantities, matchPerPersonQuantity, namedQuantityScope, orderQuantityUnit, parseFormQuantity,
  quantityScopeOf, TOTAL_QUANTITY_SCOPE,
} from './requirementQuantity';
import { REQUIREMENT_SCHEMA_VERSION } from '../types/decisions';
import type { ClarificationQuestion, Constraint, ConstraintField, DecisionRequirement, RequirementTurn } from '../types/decisions';
import type { RequirementInput } from '../types/sartoria';

type Choice = readonly [value: string | boolean, label: string, expression: string];

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const catalogColors: readonly Choice[] = FABRICS.filter(({ colorName }) => colorName && !/^未(?:指定|确定)/.test(colorName))
  .toSorted((left, right) => right.colorName.length - left.colorName.length)
  .map((fabric) => [fabric.colorFamily, fabric.colorName, escapePattern(fabric.colorName)]);

const craftAliases: Partial<Record<string, string>> = {
  'crf-haipai-pipa-button': '手工(?:琵琶)?盘扣|琵琶盘扣|盘扣',
  'crf-suzhou-magnolia-embroidery': '暗纹玉兰苏绣|(?:白)?玉兰(?:刺绣|苏绣)',
  'crf-hidden-mandarin-placket': '暗门襟(?:无痕|改良|低){0,3}立领|暗门襟工艺',
  'crf-full-canvas-guiba': '全毛衬(?:手工)?归拔',
  'crf-contrast-piping-cuff': '(?<=袖口[^，,；;。！？!?]{0,8})撞色滚边',
};

const GARMENT_TOP = '(?:上装|上衣|上身|(?:短|长)?外套|夹克)';
const GARMENT_SKIRT = '(?:裙子|下裙|半身裙|长裙|连衣裙|连身裙)';
const GARMENT_BOTTOM = `(?:${GARMENT_SKIRT}|下装|裤子|长裤|西裤)`;
const TWO_GARMENTS = '(?:两|二|2|２)件';
const COMPONENT_COUNT = `${TWO_GARMENTS}(?![式套装])`;

function garmentPair(bottom: string): string {
  const join = '(?:和|跟|与|同|加|配|搭|及|、)?';
  return `(?:${GARMENT_TOP}${join}${bottom}|${bottom}${join}${GARMENT_TOP})`;
}

const GARMENT_COMPONENT_PAIR = garmentPair(GARMENT_BOTTOM);
const TWO_PIECE_COMPOSITION = `(?:分成|分为|由)${GARMENT_COMPONENT_PAIR}(?:这?${COMPONENT_COUNT})?`;
const SEPARATE_GARMENTS = '(?:必须|需要|应当|分别|各自|做成|可以|得|要|需|就|都|是|为|能|做|\\s){0,8}' +
  `(?:${TWO_GARMENTS}(?:独立|分开的?)(?:单品)?|各自独立|独立(?:成件|制作|成衣|做)?|分穿|分开(?:穿(?:着)?|搭配|制作|做成|做为|裁剪|做|裁)?(?:成|的|各自的)?(?:${COMPONENT_COUNT})?)(?!洗|包装|清洗|寄|发货|运输)`;
const TWO_PIECE_OUTFIT = [
  `${TWO_GARMENTS}(?:式|套|装)`,
  `(?:${garmentPair(GARMENT_SKIRT)}|上下(?:装|身|两件)?)${SEPARATE_GARMENTS}`,
  '外套(?:搭|配|和|加|与).{0,5}(?:连衣裙|连身裙|长裙)|(?:连衣裙|连身裙|长裙)(?:搭|配|和|加|与).{0,5}外套',
].join('|');
const WORKWEAR = '工作服|员工服|职业[服装]|工装|工服';
const ORGANIZATION = '公司|企业|单位|部门|门店|店里|柜台|前台|会务组';
const ORGANIZATION_ROLE = '员工|同事|职工|成员|职员|导购|店员';
const CORPORATE_ORDER = [
  `团装|团服|团定|团购|团订|团体(?:定制|订做|订购|订制|采购|下单|款|套装|制服|${WORKWEAR})`,
  `团队(?:制服|统一着装|${WORKWEAR})|会务服|集体定制|(?:批量|统一)(?:定做|订做|定制)`,
  `(?:${ORGANIZATION}|${ORGANIZATION_ROLE})(?:的)?(?:${WORKWEAR}|制服)|(?:统一|集体)(?:${WORKWEAR})`,
  `(?:${ORGANIZATION}|团队)(?=[^，,；;。！？!?]{0,14}(?:统一|集体|批量|集中)(?:采购|订|订购|订做|定制|做|配发|换|下单))`,
  '(?:门店|柜台|前台)(?=(?:(?:这|本)次|这回|这批)?(?:要|准备)?(?:更换|换|补做|补订|补|配发|配|订购|采购|订|定制)[^，,；;。！？!?]{0,10}(?:西服|西装|职业套装|工装|工作服|制服))',
  `(?:${ORGANIZATION_ROLE})(?=[^，,；;。！？!?]{0,6}(?:每人|人均|人手|各自|各人|各配|各发|一人(?:一|领|配|发))[^，,；;。！？!?]{0,8}(?:套|身|件|西装|工作服))`,
  `每(?:一)?(?:个|位|名)(?:${ORGANIZATION_ROLE})(?=(?:都|统一|要|得|分别)*(?:领|配|发|订|做)[^，,；;。！？!?]{0,8}(?:套|身|件|西装|工作服))`,
  `(?:${ORGANIZATION_ROLE}|团队)(?:要|均|统一)?穿的.{0,4}(?:${WORKWEAR})|(?:发出?|开|接|下|签)团单|团单(?:采购|下单)`,
  `(?:给|为)(?:整个|我们)?(?:${ORGANIZATION}|团队|员工|职工)(?:的?(?:${ORGANIZATION_ROLE}))?(?=.{0,12}(?:定做|订做|做|定制|配|准备|订))`,
  `(?:给|为).{0,12}(?:${ORGANIZATION_ROLE})(?=.{0,10}(?:(?:统一|批量|集中)(?:定做|订做|定制|做|订|配)|每人|各一套|各做|各发|人手|一人一套))|员工服|工作服|工服`,
].join('|');
const PERSONAL_RECIPIENT = '(?:我(?:自己|本人|们俩|们两个|爸(?:爸)?|妈(?:妈)?|姐(?:姐)?|妹(?:妹)?|哥(?:哥)?|弟(?:弟)?|爱人|对象|孩子|父亲|母亲)|家人|自己|本人)';
const PERSONAL_ORDER_ACTION = '(?:订(?:制|做)?|定做|定制|做)';
const TAILOR_TO_MEASURE = `(?:实际)?(?:身体)?(?:尺寸|尺码|围度)${PERSONAL_ORDER_ACTION}`;
const PRIVATE_ORDER = [
  '(?:个人|私人|单人)(?:(?:量身|量体|高级)?[定订][制做]|高定)|个人礼服|私定|私订|个人款',
  '只给我自己|我一个人(?:穿|定[制做]|订[做制])|我(?:自己|本人)穿',
  '(?:只)?给(?:我)?(?:自己|本人)(?:做|订[做制]?|定做|定制|准备|量体)|(?:给)?我个人(?:定[制做]|订[做制]?|做|量身)',
  `(?:给|为)${PERSONAL_RECIPIENT}(?:量(?:身|体)|单独)${PERSONAL_ORDER_ACTION}|(?:给|为)我们(?:俩|两人|两个)${PERSONAL_ORDER_ACTION}`,
  `(?:照|按)(?:着)?(?:我(?:们)?自己的?|我的?)${TAILOR_TO_MEASURE}`,
  `(?<=我(?:要|想要?|准备|打算)?)(?:照|按)(?:着)?自己的?${TAILOR_TO_MEASURE}`,
  `各自(?:出钱|付款|量身|量体)?(?:来)?订(?:制|做)?(?=\\s*[零〇一二两三四五六七八九十百0-9０-９]+\\s*(?:套|身|件|条))`,
  `(?:我(?:来|想|要)?|单独)(?:做|订[做制]?|定[做制])(?=\\s*[一1１]\\s*(?:件|条)${GARMENT_AFTER_CLASSIFIER})`,
].join('|');

export const requirementFields = {
  businessType: { label: '业务类型', choices: [
    ['corporate_uniform', '团体职业服', CORPORATE_ORDER],
    ['private_couture', '个人高定', PRIVATE_ORDER],
  ] },
  quantity: { label: '数量', choices: [] },
  scene: { label: '场景', choices: [
    ...SCENES.map(({ id, name }): Choice => [id, name, escapePattern(name)]),
    ['formal_evening', '正式晚宴', '(?:室内(?:的)?(?:正式)?)?晚宴|晚礼宴|晚会|慈善宴会|正式酒会|(?:晚上|晚间|夜间)[^，,；;。！？!?]{0,12}(?:答谢|庆功)宴'],
    ['indoor_performance', '室内演出', '室内.{0,8}(?:舞台|演出|演奏|表演|演唱|独奏|独唱|合奏)|音乐厅|(?<!露天|户外|室外)剧院|(?<!露天|户外|室外)剧场(?:内|里面|里)?(?:的)?(?:演出|表演|演奏)|室内剧场'],
    ['indoor_formal', '室内正式', [
      '(?:室内|展厅|馆内|会议厅|报告厅).{0,7}(?:正式|会务|峰会|会议|商务|接待|迎宾|典礼|颁奖礼|授奖仪式|领奖|受奖|论坛)',
      '(?<!露天|户外|室外)(?:大?礼堂|礼厅).{0,6}(?:领奖|受奖|颁奖|授奖|典礼)',
      '(?:正式|会务|论坛|会展|接待|颁奖|授奖).{0,7}(?:室内|展厅|馆内)|正式礼厅|会议中心',
      '(?:礼宾接待|会议接待|商务接待)(?!(?:的)?(?:小组|组|队|班|部|科|团队|职工|员工|人员))',
    ].join('|')],
    ['outdoor_stage', '户外舞台', '(?:户外|室外|露天).{0,7}(?:舞台|台子|演出|演奏|表演|剧场|剧院)|(?:舞台|演出|演奏|表演).{0,4}(?:在|设在)(?:户外|室外|露天)'],
  ] },
  season: { label: '季候', choices: [
    ['spring', '春季', '春季|春天|春款|春日'], ['summer', '夏季', '夏季|夏天|夏款|盛夏|仲夏'],
    ['autumn', '秋季', '秋季|秋天|秋款|秋夜|秋日|深秋|入秋|秋装'], ['winter', '冬季', '冬季|冬天|冬款|寒冬|过冬'],
    ['all_season', '四季通用', '四季通用|四季可穿|全年|不分季节'],
  ] },
  category: { label: '品类', choices: [
    ['two_piece', '两件式', TWO_PIECE_OUTFIT],
    ['suit', '西装套装', '西服套装|西装套装|西服|西装(?!领)|成套西装|(?:商务|通勤|礼宾|职业|正装)套装|男士西礼服'],
    ['dress', '连衣裙／礼服', '连(?:衣|身)(?:裙|礼服)|一体式礼服|长款?礼服|晚礼服|长裙|礼服裙|礼裙|女(?:士|式|款|装)礼服|(?<=一条)礼服|(?<=(?:做|订|定制)\\s*[0-9０-９一二两三四五六七八九十百]+\\s*条[^，,；;。！？!?]{0,12})裙子'],
    ['jacket', '外套', '外套|夹克|上衣|短褂|罩衫'],
  ] },
  patternStructure: { label: '版型结构', choices: [
    ['h_line', 'H 型直身', [
      '(?:直身|直筒)?[hHＨ]\\s*[型形版线]|(?:字母\\s*)?[hHＨ]\\s*(?:一样|那样)(?:的)?(?:直|笔直)|直身(?:版型|结构|廓形)|直筒版型',
      '从(?:腋下|肩部|肩线|肩头)(?:起|开始)?(?:一直|往|向)?下(?:来)?(?:就|要|得)?(?:笔直|直直|直线|垂直)(?:往下|向下)?(?:落|垂|下)',
      '从(?:腋下|袖窿|袖笼|肩部|肩线|肩头)(?:起|开始)?(?:就|要|得)?(?:一路|一直)?(?:笔直(?:地)?|直直(?:地)?|直着)(?:往|向)?下(?:落|垂|走|顺|来|去)',
    ].join('|')],
    ['two_piece', '两件式', `上下(?:分成|分为)?${COMPONENT_COUNT}|${TWO_PIECE_COMPOSITION}|${GARMENT_COMPONENT_PAIR}${SEPARATE_GARMENTS}|${TWO_PIECE_OUTFIT}`],
  ] },
  collar: { label: '领型', choices: [
    ['cross_open', '交领开襟', '交领'], ['diagonal', '斜襟', '斜襟'],
    ['stand', '立领', '(?:矮|低|小)?(?:立领|竖领)|领(?:子|口|型)(?:得|要|必须|应该|就|会|能)*(?:(?:矮矮?|低低?)地?|稍微|略微?|微微)?(?:竖|立)(?:起(?:来)?|着)'],
    ['lapel', '翻领', '(?:(?:西装|西服)(?:的)?)?(?:窄|宽|尖|平){0,2}(?:翻领|驳领)|西装领|西服领|外翻领|(?<=领(?:口|型|子)[^，,；;。！？!?]{0,10})(?:向|往)外翻'],
  ] },
  fabric: { label: '面料', choices: [
    ['blend', '混纺', '(?:棉涤|丝毛|毛丝|涤棉|毛涤)?混纺'], ['silk', '真丝', '纯真丝(?!混纺)|真丝(?!混纺)|桑蚕丝(?!混纺)|纯蚕丝|全蚕丝'],
    ['wool', '羊毛', '纯羊毛(?!混纺)|羊毛(?!混纺)|精纺毛料|全毛(?!衬)|纯毛'], ['polyester', '涤纶', '涤纶(?!混纺)|聚酯(?:纤维)?(?!混纺)'],
    ['acetate', '醋酸', '醋酸(?!混纺)'], ['velvet', '丝绒', '丝绒|天鹅绒'],
  ] },
  color: { label: '色系', choices: [
    ['ivory_rose', '象牙玫瑰', '象牙玫瑰|(?:米白|象牙白)(?:色)?(?:撞|拼接?|搭配?|配(?:上)?|加(?:上)?|与)(?:亮粉|玫瑰粉)(?:色)?'],
    ['navy', '藏青', '藏青(?:色)?|藏蓝(?:色)?|深海军蓝|海军(?:深|藏)?蓝|深蓝(?:色)?|午夜蓝'],
    ['obsidian', '墨黑', '墨黑|黑色|炭黑|纯黑|纯墨色|墨色'], ['ivory', '象牙白', '象牙白|月白|米白(?:色)?|乳白(?:色)?'],
    ['crimson', '绯红', '绯红|绛红(?:色)?|枣红(?:色)?|深红(?:色)?|酒红(?:色)?|正红(?:色)?'],
    ['stone_gray', '暖灰／深灰', '石板灰|石灰色|暖灰(?:色)?|深灰(?:色)?|炭灰(?:色)?|灰色'],
    ['pine_green', '松绿', '松(?:针|墨)绿(?:色)?|深?松绿(?:色)?|墨绿(?:色)?|深绿(?:色)?'],
    ['champagne', '香槟', '香槟(?:金|色)'], ['mist_blue', '雾蓝', '雾蓝(?:色)?|浅蓝(?:色)?'],
    ['earth_brown', '大地棕', '大地棕|棕色|咖啡色|土棕|墨褐|茶褐|深褐(?:色)?'], ['neutral_silk', '丝本色', '丝本色|真丝原色'],
  ] },
  motif: { label: '装饰纹样', choices: [
    ['subtle_jacquard', '含蓄暗纹', '(?:织(?:进去|出来|入|造|成|进布面|在布面上)(?:的|去的)?(?:同色|低调|细小)?|同色织(?:的|成的)?)?(?:暗纹|暗花)|低调提花'],
    ['plain', '素面', '素面|纯色(?:且|并且)?无(?:花(?:纹)?|纹(?:样)?|图案)|无纹样|无花纹|无图案|(?:不能|不要|不得|不许|不用|别|不)(?:再)?织(?:出|入|上)?(?:任何)?(?:花纹|纹样|花)(?=$|[、\\s]|就行|即可|就好)'],
  ] },
  lengthRatio: { label: '长度比例', choices: [
    ['mid_hip', '及臀中', '臀中|及臀(?!下|底|根)|(?:臀部?|屁股)(?:正中|中间|中段|中点|中部)|(?:到|至|齐)臀部(?!下|底|根)'],
    ['ankle', '及踝', '及踝|(?:到|至|齐|及)脚踝|到踝部|(?:留|停|落|垂|收)在脚踝'],
    ['floor', '及地', '及地|拖地|曳地|拂地|擦地|落地长|(?:拖|垂|落)(?:到|至)地(?:面|板|上)?|到地(?:面|板)|到地(?=$|\\s|即可|就行)|贴地(?:长)?|贴着地面|裙(?:摆|边|脚)齐地'],
  ] },
  easeAllowance: { label: '松弛余量', choices: [
    ['arm_mobility', '肩臂活动余量', [
      '(?:不要|不能|别|不|避免)压肩|(?:不要|不能|别|不)勒肩|(?:不要|不能|别|不)卡(?:住)?(?:手臂|胳膊|臂|肩)|(?:不|别)夹(?:腋下|胳膊)',
      '(?:抬|举|举起)(?:胳膊|臂|手)(?:时)?(?:、坐奏都要方便|.{0,8}(?:不卡|方便|自然|顺畅|自如|舒展|伸得开|不受限|不紧绷|不(?:能|要|会|可)?(?:被(?:衣服|成衣|袖子|袖口|肩袖))?(?:卡住|扯住|拉住|勒住|牵扯)|有余量|留(?:足|够|出)(?:活动)?余量))',
      '(?:袖子|袖管|胳膊|手臂|双臂).{0,6}(?:抬|举)得(?:起(?:来)?|开|高|动)|肩(?:臂|背)(?:活动)?余量',
      '(?:胳膊|手臂|双臂)(?:一定|必须|需要|应该|都|得|要)*(?:能|可以)(?:自由地?|轻松地?|顺畅地?)?(?:抬|举)(?:起(?:来)?|开|高)',
      '(?<=(?:袖子|衣袖|袖管|肩袖)的?(?:设计|剪裁|最好|希望|尽量|需要|应该|必须|务必|一定|要|得|就|都|也|能|\\s){0,5})(?:方便|便于)(?:抬|举)(?:起)?(?:手(?:臂)?|胳膊|臂)',
      '(?:肩(?:膀|部)?(?:和|与|跟|及|、))?(?:袖子|袖管|袖口|肩袖|衣袖)(?:都|千万|绝对|一定)?(?:别|不要|不能|不许|不得)(?:拽[住着]|扯[住着]|牵扯|拉[住着]|卡[住着]|勒[住着])(?:我|人|肩(?:膀)?|手臂|胳膊)?',
      '(?:袖笼|袖窿)(?:部位|位置)?(?:需要|必须|应该|宜|要|得)?(?:放量|留(?:足|够|出|有)?(?:活动)?(?:余|松)量|预留(?:活动)?(?:余|松)量)|(?:坐奏|坐着演奏).{0,5}(?:方便|不卡|活动)',
    ].join('|')],
  ] },
  closure: { label: '开合细节', choices: [
    ['no_visible_buttons', '无外露纽扣', '无外露(?:的)?(?:纽扣|扣子|扣)|不(?:要|用|许)(?:看见|露出|外露)(?:纽扣|扣子|扣)|(?:纽扣|扣子|扣件)(?:也|仍然?|还是|始终|一律)?(?:都)?(?:不要|不能|不可|不得|不许|禁止)(?:外露|露(?:出|在外)?)|隐藏纽扣|隐门襟|暗扣|隐扣|无明扣|无扣式'],
    ['visible_buttons', '外露纽扣', '外露(?:的)?(?:纽扣|扣子|扣)|明扣'],
  ] },
  care: { label: '洗护', choices: [
    ['machine_wash', '可机洗', '机洗|机水洗|洗衣机(?:洗)?|滚筒洗'], ['dry_clean', '干洗', '(?:专业(?:的)?|送店)?干洗'], ['hand_wash', '手洗', '手洗|手工水洗'],
  ] },
  wrinkleResistance: { label: '耐皱', choices: [
    [true, '要求耐皱', '耐皱|抗皱|防皱|抗褶皱|免熨|免烫|不(?:易|容易)皱|不(?:易|容易)起(?:褶|皱)|不起(?:皱|褶)|不容易压出折痕|(?:别|不要|不能|不得|不许)(?:全是|都是|起|留下?|挤出|压出)(?:一身|满身|一堆)?(?:褶(?:子|皱)?|折痕)'],
    [false, '可接受易皱', '易皱|容易起(?:褶|皱)|容易皱'],
  ] },
  luster: { label: '光泽', choices: [
    ['high', '高光泽', '更亮(?!的?(?:颜色|色系))|亮(?:一点|一些)(?!的?(?:颜色|色系))|太亮|高光泽|高反光|强反光|光泽更强|光泽更高|丝光明显|高?亮面|一(?:照|打光|开灯)就(?:很|特别)?(?:晃|刺)眼|(?:晃|刺)眼的?反光|反光(?:很|太|特别|非常|格外)?(?:晃眼|刺眼|强)'],
    ['medium', '微光泽', '柔(?:和|润)(?:的)?微光|柔光|微光泽|微亮|微光|少许光泽|有一点光泽'],
    ['low', '低光泽', '低光泽|哑(?:面|光)|亚光|消光|低反光|少(?:一)?点反光'],
  ] },
  style: { label: '风格', choices: [
    ['traditional_uniform', '传统制服', '(?:传统|老式)(?:(?:单位|企业|机关|公司|制式|职业|礼宾)(?:的)?)?(?:制服|团装|工装|工服|工作服)|(?:传统|老式)(?:的)?职业(?:装|套装)|礼宾制服|制服(?:感|味)'],
    ['modern', '现代利落', '现代(?:感|风(?:格)?|简约|极简|利落|商务|款|造型|(?=$|\\s|一点|一些))|(?:简约|极简|轻)商务|极简(?:风格|风|造型)'],
    ['new_chinese', '新中式', '新中式|改良中式|中式改良'],
  ] },
  craft: { label: '工艺', choices: CRAFTS.map((craft): Choice => [
    craft.id, craft.shortName, [craft.name, craft.shortName, craft.code, craft.id].map(escapePattern)
      .concat(craftAliases[craft.id] ?? []).join('|'),
  ]) },
} satisfies Record<ConstraintField, { label: string; choices: readonly Choice[] }>;

export const requirementFieldIds = Object.keys(requirementFields) as ConstraintField[];

export function isRequirementValue(field: ConstraintField, value: unknown): value is NonNullable<Constraint['value']> {
  return field === 'quantity'
    ? typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    : requirementFields[field].choices.some(([choice]) => value === choice);
}

export function describeRequirementValue(field: ConstraintField, value: Constraint['value'], quote?: string | null,
  quantityScope?: Constraint['quantityScope']): string {
  if (value === null) return '待确认';
  if (field === 'quantity' && typeof value === 'number') return describeOrderQuantity(value, quote, quantityScope);
  return requirementFields[field].choices.find(([choice]) => choice === value)?.[1] ?? String(value);
}

type Observation = Pick<Constraint, 'field' | 'value' | 'op' | 'level' | 'reason' | 'quote' | 'blocking' | 'withdraws' | 'quantityScope'> & {
  resolvesPending?: true;
};
type ReferenceExclusion = { observation: Observation; supersedes?: { clauseIndex: number; value: Observation['value'] } };
interface FieldMatch {
  value: NonNullable<Observation['value']>;
  start: number;
  end: number;
}
const PREFERENCE = /(?:最好|优先|倾向|偏好|偏爱|尽量|希望|想要|不想|喜欢|中意|更偏|可考虑|对比|更想|建议|提议|有条件的话)/;
const TRAILING_ACTOR = /^(?:(?:我(?:们)?|客户|买方|采购|后勤|行政|设计师|版师)(?:个人|本人|这边)?|个人|本人|这边)\s*/;
const PREFERENCE_AFTER = /^(?:(?:即可|为佳|为好|优先|就好|最好|更好|有(?:当然)?更好)|(?:比较|相对|较|挺|更|蛮|也|还|很|特别|最|倒是)*\s*(不(?:太|那么|怎么)?)?(?:喜欢|偏好|偏爱|中意|看好|倾向))/;
const PERMITTED_BEFORE = /(?:可以|可|允许)(?:采用|选用|用|做成|选|做|使用|考虑)\s*$/;
const PERMITTED_AFTER = /^(?:(?:(?:也|亦|都|同样)\s*)?(?:可以|可|允许)(?:采用|选用|使用|用|选|接受)|(?:(?:也|亦|都)可(?:以)?|可以)$)/;
const MANDATORY = /(?:必须|务必|只能|仅限|(?<!未|没|不)指定|非要|(?<!不)一定要|不可|不能|不允许|不接受|严禁|绝不|不得|不许|禁止|硬性|必选|都得|都要|只准|切忌|谢绝)/;
const NEGATIVE_HEAD = '不能|不可|不要|不得|不许|避免|避开|远离|不接受|不考虑|排除|不想要|不想|不(?:太|那么|怎么)?(?:喜欢|偏好|偏爱|中意)|不希望|不用|不选|不穿|不准|不宜|不像|不做|不采用|不是|不在|不使用|不允许|不支持|别用|别选|别要|别像|别|拒绝|禁止|严禁|禁用|禁|忌用|切忌|谢绝|杜绝|不能有|无外露|无|非(?!要)|绝不';
const NEGATION = new RegExp(`(?:${NEGATIVE_HEAD})(?:\\s|再|给|要求|规定|要|订购|订|购买|买|采购|挑|选|用|使用|采用|穿|是|有|含有|含|带去|拿去|拿来|拿|把|放进|送(?:去|到)?|叫人|弄得|弄成|像|做成|做|那种|类似|太|特别|那么|任何|一样|略带|的)*$`);
const COORDINATOR = /^(?:、|和|跟|与|以?及|或(?:者|是)?|还是|\/|／)\s*(?:也|同样)?$/;
const FORBIDDEN_AFTER = /^(?:(?:则|都|也|一律|一定|明确|坚决|绝对|完全|仍然?|还|始终|严格|暂且|照样|同样|请)\s*)*(?:不要|不得|不许|不做|不用|不行|不可以|不能用|不允许|不考虑|不接受|不采用|不选|不一样|区别开|禁用|禁止|(?:被)?排除(?:在外)?|排掉|剔除|别(?:再)?(?:拿来|拿|替进来|替换|替|用|选|要|做|加|上|放|考虑)|不准用|禁)/;
const WITHDRAWAL = /(?:撤回|收回(?=.{0,16}(?:要求|规定|限制|硬条件|必选项))|撤销|取消|放弃|去掉|撤掉|删(?:掉|除|去)|不再要求|不要求|不需要|不强求|不强制|不硬性要求|不是必须|并非必须|不必|不用限定|不用(?:把|将).{1,20}(?:设|列|当|定|写)(?:成|为).{0,6}(?:必选|硬性|必须|要求|条件)|不限制|不再限定|无需|不限|无要求|没有.{0,8}要求|不作要求)/;
const UNAPPROVED_WITHDRAWAL = /(?:(?:尚未|还没(?:有)?|未曾|未经|没有|还未|未)(?:被|能)?(?:获准|得到批准|批准|同意|授权|许可|允许)?|先别|暂不|不能|别)(?:直接|自行|正式|先)?(?:撤回|收回|撤销|取消|作废|去掉|撤掉|删(?:掉|除|去))/;
const AMBIGUITY = /(?:不确定|未确定|不一定|未指定|没定|待确认|未定|再说|先不定|待定|待选|没拍板|(?:还没|尚未|仍未|没)(?:想好|想清楚|拿定主意|决定)|(?:再|还要)(?:想想|琢磨|斟酌)|先(?:留白|留空|空着)|先别(?:填|定|选|决定)|暂不(?:定|选|决定)|随意|都行|都可以|无所谓|看情况|左右|大概|差不多|约(?:为|有)?\s*[\d一二三四五六七八九十]|[\d一二三四五六七八九十]\s*(?:到|至|[-~～])\s*[\d一二三四五六七八九十])/;
const OPEN_QUESTION = /(?:([穿用做选去换留改是])不\1(?=$|[这那些的呢啊吧])|(?:要不要|能不能|该不该|可不可以|是否)(?=\s*(?:穿|用|做|选|去|换|留|改|是|采用)|\s*$))/;
const AWAITING_REVIEW = new RegExp([
  /等(?:待)?.{0,14}(?:再定|再拍|再选|再填|确认|决定|审批|批复|回复|建议|回我|看完|看过|点头|拍板|问|(?:签(?:字|完)?|定|批)(?=$|[吧呢])|(?:出|发|给|提供|公布|拿到|通知).{0,4}(?:日程|排期|时间|日期|档期|安排|结果|通知|意见|名单|方案|色卡|样卡))/.source,
  /(?:尚未|还没|仍未)(?:拍板|批|签|点头|给|出|收到)|还在(?:核|审|确认|考虑|讨论|研究|商量)|还(?:得|要|需).{0,14}(?:点头|签字确认|批准|拍板)|(?:得|还要|还需)(?:先|再)?问/.source,
  /(?:看|摸|试|比)(?:完|过|了|样(?:品|衣|布|卡)?|图).{0,9}再(?:定|选|拍|确认|填|决定|给(?:个|句)?准话)/.source,
  /(?:想|要|先|准备)(?:拿|看|比|摸).{0,8}(?:样(?:品|衣|布|卡)?|色卡).{0,8}(?:再)?(?:选|定|挑)(?:定|选|了|吧)?$/.source,
].join('|'));
const REFERENCE_ONLY = /(?:(?:只|仅)(?:是|供|作|当作|用作|作为)?\s*(?:(?:比例|轮廓|搭配|剪裁)(?:的)?\s*)?(?:参考|对照|示意|备选|候选)|可(?:以)?(?:先)?(?:参考|对照)|(?:可以|先)(?:放|摆|列)(?:在|入|作|为)?(?:备选|候选)|(?:可作(?:为)?|留作)(?:备选|候选|参考)|不(?:算|作为)正式要求|先(?:看(?:一)?看|试(?:一)?试|看样|试穿|打样|(?:拿|送|带|摆)(?:来|出来)(?:给.{0,4})?(?:看(?:一)?看|试(?:一)?试|看样|试穿)))/;
const SAMPLE_BEFORE = /(?:拿|送来?|挑|备好?|摆|找|看|摸|试(?:穿|用|做)?|比对)(?:过|了)\s*$/;
const SAMPLE_AFTER = /^(?:先)?(?:给|让|供)(?:我(?:们)?|客户|买方|设计师|版师)(?:先)?(?:试(?:试看|穿|用)?|看(?:看|样)?|比较)(?:了|过|了下|一下|一眼|一回|试)?$/;
const CONFIRMED_BEFORE = /(?:已(?:经)?|现已|最终|正式|刚刚|刚|就|当场)(?:定(?:下|为|了)?|决定|确认|敲定|拍板|签字确认|选定|确定)(?:要|用|改用|为|做|选)?\s*$/;
const CONFIRMED_AFTER = /^(?:已经|现已|最终|正式|刚刚|刚|当场)(?:定下|定了|确定|确认|敲定|拍板|签字确认)(?:了)?(?:吧|啦)?$/;
const REVIEW_DEPENDENCY = /(?:等(?:待)?|尚未|还没|如果|要是)(?:(?!最后|现在|后来|终于|现已|已经).){0,14}$/;
const PROPOSES_CONFIRMATION = /(?:建议|提议|考虑|打算|希望|想(?:要)?|能否|可否)(?:(?!但|最后|后来|终于|已(?:经)?).){0,14}$/;
const PROTECTED = /(?:不动|保持不变|保持原样|不变|保持原来|按原来|照原来|按已(?:经)?确认|按此前确认|沿用已(?:经)?确认|照前一版|保留原|维持原|照旧|维持现状|仍(?:然)?保留|继续保留|依然保留|(?:还是|仍然?|继续|维持|沿用)(?:用|采用|按|照)?原(?:计划|方案|单)|(?:按|照)原(?:计划|方案|单)|(?:维持|保留|沿用)(?:原)?(?:订单|工单|合同)(?:里|中|上)?的|(?:保留|沿用|维持|还是要)(?:刚|此前|之前|已(?:经)?)(?:签(?:过字)?|确认|定)(?:下|了)?的)/;
const EXPLICIT_CONTINUATION = /(?:照旧|按原来|照原来)(?:\s|继续)*(?:用|采用|选用|走|做|执行)/;
const HISTORICAL_LEAD = /^(?:(?:我(?:们)?|客户|买方|采购|后勤|行政)(?:的)?\s*)?(?:上(?:一)?(?:批|回|次|版|条|套|件)|前一(?:批|回|次|版|件)|旧(?:批次|工单|订单|样衣|样品))/;
const HISTORICAL_ORDER = /(?:去年|前年|上(?:个(?:月|季度|礼拜|星期)|周末?|月|季度)|前(?:一|两)(?:个)?(?:月|周|年)|以前|之前|先前|此前|当时).{0,16}?(?:下(?:了|过)单|下单(?:了|过)|(?:订(?:购|做|制)?|定(?:制|做)?|采购|买|做|签(?:署)?)(?:了|过)|(?:订(?:的|下的)|采购的|签(?:署|下)?的)(?:订单|工单|合同))/;
const HISTORICAL_REPORT = /(?:之前|先前|此前|原先|早先)(?:曾经?|曾)?(?:传(?:闻|言)?|说(?:过)?|提(?:过)?|写(?:过)?|要求(?:过)?)(?:的)?是/;
const HISTORICAL_INTENT = /(?:原本|原先|最初|以前|之前|先前|此前)(?:是|还)?(?:打算|计划|考虑|想(?:过|要)?|建议)/;
const LOANED_SAMPLE = /(?:试穿|试过|试了)(?:过|了)?(?:借来的|旧的|旧样|上(?:一)?(?:批|回|次|版))/;
const CURRENT_CONTEXT = /(?:(?:这次|本次|这回|本轮|现在|目前|现已|最终|今年)(?=.{0,18}(?:要|用|改|定|签|确认|敲定|穿|执行|保留|按|走))|(?:仍然?|继续|照常)(?=要求|执行|采用|用|按|做))/;
const REFERENCE_ARTIFACT = new RegExp(`${REFERENCE_IMAGE}(?:里(?:面)?|中|上(?:面)?|这张|那张)?(?:的[^，,；;。！？!?]{0,16}|\\s*(?:(?:仅|只)?供|用来|拿来|用作|作为)参考)?$|(?:张|幅|拍的|发来的|发的|给的)[^，,；;。！？!?]{0,18}照$`);
const ADOPTED_REFERENCE = new RegExp(`(?:按|照)(?:着)?(?:这张|那张|该)?${REFERENCE_IMAGE}(?:里(?:面)?|中|上(?:面)?)的.{1,14}(?:做|用|选|定|打版|留料)$`);
const REPORTED_QUESTION = /问(?:了|过)?[^，,；;。！？!?]{0,8}?(?:能不能|可不可以|要不要|该不该|是否(?:可以?|能够?)?|怎么|能否)/;
const PROPOSED_ACTION = /^(?:添[加上]|加(?:上)?|补(?:上)?|采用|选用|用|做|换成|改(?:成|为|定为))/;
const PROPOSED_REQUIREMENT = /^(?:把|将)\s*(.{1,32}?)\s*(?:加(?:入|进|成|为)|列(?:入|为)|纳入|写(?:入|进|成)).{0,12}(?:要求|条件|条款|标准)$/;
const EVIDENCE_DOCUMENT = /(?:依据|证据|证明|报告|说明|证书|标签|检测|测试)(?:材料|文件)?$/;
const CANCEL_PROPOSED_CHANGE = /(?:取消|撤销|撤回|收回|不采纳|不批准)(?:刚才|本次|这次|这项|那项|这条).{0,18}(?:改动|改稿|变更|调整|修改|提议|建议|请求)/;
const CHANGE = /(?:改回(?:成|为)?|换回(?:成|为)?|改成|改为|改定为|换成|换为|替换为|调整为|调整成|调整到|追加至|加到|增至|增加到|减至|减到|缩减到|提高到|降到|改用|换用|改做|(?<![修更篡])改(?!良|进|善|造|版|动|编|过|写|稿)(?=\S))/;
const WRAPPED_SWAP = /(?<=^(?:把|将).{1,16})换(?=\s*\S)/;
const ALTERNATIVE = /(?:或(?:者|是)?|还是|二选一|择一|任选)/;
const TENTATIVE_CHANGE = /(?:想(?:要|先|试着)?|考虑(?:先)?|试着)\s*$/;
function patternsFor(field: ConstraintField, segment: string, inheritsStage = false): FieldMatch[] {
  if (field === 'quantity') {
    const twoPiece = [...patternsFor('category', segment), ...patternsFor('patternStructure', segment)]
      .some(({ value }) => value === 'two_piece');
    return matchOrderQuantities(segment, twoPiece);
  }
  // Match only the location word so a preceding prohibition remains visible to the polarity parser.
  const matches: FieldMatch[] = field === 'scene' ? stageLocations(segment, inheritsStage) : [];
  const covered = new Set<number>();
  for (const { start, end } of matches) for (let i = start; i < end; i++) covered.add(i);
  const choices = field === 'color' ? [...catalogColors, ...requirementFields.color.choices] : requirementFields[field].choices;
  for (const [value, , expression] of choices) {
    for (const match of segment.matchAll(new RegExp(expression, 'gi'))) {
      const indexes = Array.from({ length: match[0].length }, (_, index) => match.index + index);
      if (indexes.some((index) => covered.has(index))) continue;
      indexes.forEach((index) => covered.add(index));
      matches.push({ value, start: match.index, end: match.index + match[0].length });
    }
  }
  return matches;
}

function namesColor(text: string): boolean {
  return UNMAPPED_COLOR.test(text) || patternsFor('color', text).length > 0;
}

function unresolved(field: ConstraintField, quote: string, reason: string, blocking = false): Observation {
  return { field, op: 'eq', value: null, level: 'pending', quote, reason, ...(blocking ? { blocking: true } : {}) };
}

const WITHDRAWAL_REASON = '原话明确撤回该要求。';
const REFERENCE_REASON = '原话只将该项列为参考或备选，取值尚未指定。';
const UNSETTLED_REASON = '原话给出的范围或取值尚不确定。';
const PENDING_COLOR_REASON = '原话中的颜色仍需确认，尚未定色。';
const UNMAPPED_COLOR_PREFERENCE = '原话表述的色彩偏好需要人工复核。';
const ALLOCATION_SPLIT = /(?:男女(?:款|装|版)?|各(?:款|类|组|岗|岗位|班次|尺码))(?:各(?:自)?|分别)?(?:要|做|订|定|留|分|配){0,2}(?:多少|几(?:套|件|身|条)|数量|套数|件数)/;

export function isPendingQuantityBreakdown(item: Constraint): boolean {
  return item.field === 'quantity' && item.level === 'pending' && ALLOCATION_SPLIT.test(item.quote ?? '');
}

export function isIndependentQuantityReview(pending: Constraint, edited: Constraint): boolean {
  if (pending.field !== 'quantity' || edited.field !== 'quantity' || pending.level !== 'pending' || pending.blocking) return false;
  if (isPendingQuantityBreakdown(edited)) return !isPendingQuantityBreakdown(pending);
  if (isPendingQuantityBreakdown(pending)) return true;
  const scope = pending.quantityScope ?? namedQuantityScope(pending.quote ?? '');
  return Boolean(scope && scope !== quantityScopeOf(edited));
}

export function isExplicitWithdrawal(constraint: Constraint): boolean {
  return constraint.state === 'unknown' && constraint.reason === WITHDRAWAL_REASON && constraint.quote !== null;
}

export function targetsWithdrawal(withdrawal: Constraint, existing: Constraint): boolean {
  if (withdrawal.field !== existing.field || existing.value === null) return false;
  const scope = withdrawal.field === 'quantity' ? withdrawal.quantityScope ?? namedQuantityScope(withdrawal.quote ?? '') : undefined;
  if (scope && scope !== quantityScopeOf(existing)) return false;
  const target = withdrawal.withdraws;
  return !target || target.op === existing.op && target.value === existing.value;
}

function predicateFor(field: ConstraintField, value: FieldMatch['value'], excluded: boolean): NonNullable<Constraint['withdraws']> {
  if (field === 'closure' && excluded) {
    return { op: 'eq', value: value === 'visible_buttons' ? 'no_visible_buttons' : 'visible_buttons' };
  }
  return { op: excluded ? 'neq' : 'eq', value };
}

const fieldMentions: Partial<Record<ConstraintField, RegExp>> = {
  color: /颜色|色系|色彩|色调|色号|配色|主色|色卡/,
  fabric: /材质|面料|布料|用料|料子|主料|织物|纤维成分|成分(?:比例)?|纯棉|棉质|亚麻|苎麻|锦纶|聚酰胺|真皮|皮革|莱赛尔|天丝|粘胶/,
  care: /洗护(?:方式|方法)?|养护(?:方式|方法)?|清洗(?:方式|方法)|护理方式|洗标|打理方式|水洗/,
  quantity: /数量|套数|件数/, scene: /场合|场景|场地(?!方|经理|协调|负责|管理|人员|同事)/, season: /季候|季节/, category: /成衣品类|服装品类/,
  luster: /光泽|亮度/, closure: /门襟(?!\s*(?:工艺|刺绣|装饰|纹样|钉缀|图案))|纽扣|扣子|扣合方式/, motif: /纹样|图案|花型|花纹|纹饰/,
  easeAllowance: /松量|松弛余量|袖笼|袖窿|肩臂活动|肩背活动|袖管活动/, lengthRatio: /衣长|裙长|裙脚|裙摆|下摆|长度比例/,
  collar: /领型|(?:衣领|领子|领口)(?:的)?(?:造型|款式|形状|样式)|(?:领子|领口|衣领)(?=(?:务必|必须|一定要|要|得)?(?:做成|裁成|制成))/, patternStructure: /版型结构|廓形/, style: /风格|调子/,
  businessType: /业务类型|定制类型/, craft: /工艺|盘扣|刺绣|珠片|亮片/,
};

type LocatedField = Pick<FieldMatch, 'start' | 'end'> & { field: ConstraintField };

function catalogScopedMatches(field: ConstraintField, matches: FieldMatch[], target: string, craftMatches: FieldMatch[], collarMatches: FieldMatch[]) {
  if (field === 'craft') return matches;
  const compositions = field === 'category' ? [...target.matchAll(new RegExp(TWO_PIECE_COMPOSITION, 'g'))] : [];
  return matches.filter((match) => {
    if (craftMatches.some(({ start, end }) => start <= match.start && end >= match.end &&
      /(?:工艺|织法|缝法|点缀|缝制).{0,8}$/.test(target.slice(0, start)))) return false;
    if (field === 'category') {
      if (collarMatches.some(({ start, end }) => start <= match.start && end >= match.end)) return false;
      if (compositions.some((phrase) => phrase.index <= match.start && phrase.index + phrase[0].length >= match.end)) return false;
      if (match.value === 'two_piece' && (/(?:版型|结构|廓形|剪裁).{0,5}$/.test(target.slice(0, match.start)) ||
        /^(?:的)?(?:结构|构成|版型)/.test(target.slice(match.end)))) return false;
    }
    if (field === 'businessType' && match.value === 'corporate_uniform' && /(?:传统|老式)(?:的)?$/.test(target.slice(0, match.start))) return false;
    if (field === 'fabric' && (/(?:仿|仿制|像|仿若|形似|类似|接近)\s*$/.test(target.slice(0, match.start)) ||
      /^(?:般|一样|似的|手感|质感|效果|光感)/.test(target.slice(match.end)))) return false;
    if (field === 'collar' && match.value === 'diagonal' && !/领(?:子|口|型).{0,7}$/.test(target.slice(0, match.start)) &&
      craftMatches.some(({ start }) => start >= match.end && /^(?:部位|处|上|工艺|位置)?\s*(?:指定|使用|选用|用|缀|缝|做|加)$/.test(target.slice(match.end, start)))) return false;
    return true;
  });
}

function locateRequirementValues(target: string, inheritsStage = false) {
  const crafts = patternsFor('craft', target);
  const collars = patternsFor('collar', target);
  const groups = requirementFieldIds.map((field) => ({
    field,
    matches: catalogScopedMatches(field,
      field === 'craft' ? crafts : field === 'collar' ? collars : patternsFor(field, target, inheritsStage),
      target, crafts, collars).sort((left, right) => left.start - right.start),
  }));
  const venues = groups.find(({ field }) => field === 'scene')?.matches
    .filter(({ value }) => SCENES.some(({ id }) => id === value)) ?? [];
  for (const group of groups) {
    if (group.field !== 'scene') group.matches = group.matches.filter((item) =>
      !venues.some(({ start, end }) => start <= item.start && item.end <= end));
  }
  return groups;
}

function isUnsettled(scope: string): boolean {
  return AMBIGUITY.test(scope) || AWAITING_REVIEW.test(scope) || OPEN_QUESTION.test(scope);
}

function explicitlyRequired(prefix: string, trailing: string, statusScope: string): boolean {
  return MANDATORY.test(statusScope) || NEGATION.test(prefix) || FORBIDDEN_AFTER.test(trailing) ||
    !PREFERENCE.test(statusScope) && /(?:需要|限定|必须|锁定|只能|只用|要用|得用|(?:要|得)(?:裁成|做成|制成)|只接受|非得|固定|最少|至少|至多)/.test(statusScope);
}

function trailingStance(suffix: string, field: ConstraintField): string {
  const label = fieldMentions[field]?.exec(suffix);
  const afterLabel = label?.index === 0 ? suffix.slice(label[0].length).trimStart() : suffix;
  const afterActor = afterLabel.replace(/^(?:本身|这一(?:项|款|类|种)|这(?:款|类|种))\s*/, '').replace(TRAILING_ACTOR, '');
  return field === 'color' ? afterActor.replace(/^(?:(?:这次|这回|本次|本单|现在)\s*)?(?:就(?=别|不|排除))?/, '') : afterActor;
}

const LEADING_STANCE = new RegExp(`^(?:${NEGATIVE_HEAD}|${MANDATORY.source}|${PREFERENCE.source}|请|定为|就用|只用|可以|可用|要用|得用|改用)`);
const TRAILING_PENDING = new RegExp(`^(?:${AMBIGUITY.source}|${AWAITING_REVIEW.source}|${REFERENCE_ONLY.source})`);

function gapBoundary(gap: string, left: LocatedField, right: LocatedField): number {
  const trimmed = gap.trimStart();
  const trailing = trailingStance(trimmed, left.field);
  const predicate = FORBIDDEN_AFTER.exec(trailing) ?? PERMITTED_AFTER.exec(trailing) ?? PREFERENCE_AFTER.exec(trailing);
  const nextLabel = fieldMentions[right.field]?.exec(gap);
  if (predicate) {
    const end = gap.length - trailing.length + predicate[0].length;
    if (LEADING_STANCE.test(gap.slice(end).trimStart()) || (nextLabel?.index ?? -1) >= end) return end;
  }
  const pending = TRAILING_PENDING.exec(trailing);
  if (pending) {
    const end = gap.length - trailing.length + pending[0].length;
    const rest = gap.slice(end).trimStart();
    if (LEADING_STANCE.test(rest) || !rest && left.field !== right.field) return end;
  }
  return nextLabel?.index ?? 0;
}

function nearbyLanguage(target: string, current: LocatedField, anchors: LocatedField[]) {
  const closestBefore = (start: number) => anchors.findLast(({ end }) => end <= start);
  const closestAfter = (end: number) => anchors.filter(({ start }) => start >= end)
    .sort((left, right) => left.start - right.start)[0];
  let start = current.start;
  let previous = closestBefore(start);
  while (previous && COORDINATOR.test(target.slice(previous.end, start).trim())) {
    start = previous.start;
    previous = closestBefore(start);
  }
  const fromPrevious = target.slice(previous?.end ?? 0, start);
  const prefix = previous ? fromPrevious.slice(gapBoundary(fromPrevious, previous, current)) : fromPrevious;
  // A predicate after a coordinated list can govern each of its members.
  let last = current;
  let following = closestAfter(last.end);
  while (following && COORDINATOR.test(target.slice(last.end, following.start).trim())) {
    last = following;
    following = closestAfter(last.end);
  }
  const towardNext = target.slice(last.end, following?.start ?? target.length);
  const suffix = (following ? towardNext.slice(0, gapBoundary(towardNext, last, following)) : towardNext).trim();
  return { prefix, suffix, trailing: trailingStance(suffix, last.field), statusScope: prefix + target.slice(current.start, current.end) + suffix };
}

function reportedSwap(directive: string, inheritsStage: boolean): RegExpExecArray | null {
  const swap = WRAPPED_SWAP.exec(directive);
  if (!swap) return null;
  const previous = locateRequirementValues(directive.slice(1, swap.index), inheritsStage);
  const replacement = locateRequirementValues(directive.slice(swap.index + swap[0].length).trimStart(), inheritsStage);
  return previous.some(({ field, matches }) => matches.length === 1 &&
    replacement.some((group) => group.field === field && group.matches.some(({ start }) => start === 0))) ? swap : null;
}

function readSegment(segment: string, mode: 'initial' | 'revision' = 'revision', inheritsStage = false,
  nextCancelsProposal = false, colorCondition = '', colorContinuation: string | null = null): Observation[] {
  const untouched = /(?:其余|其他|其它|剩下(?:的)?).*$/.exec(segment);
  let clause = untouched && PROTECTED.test(untouched[0]) ? segment.slice(0, untouched.index).trim() : segment;
  const priorIntent = HISTORICAL_INTENT.exec(clause);
  const history = HISTORICAL_LEAD.exec(clause) ?? HISTORICAL_REPORT.exec(clause) ?? priorIntent ??
    HISTORICAL_ORDER.exec(clause) ?? LOANED_SAMPLE.exec(clause);
  let canceledProposal = false;
  if (history) {
    const backgroundEnd = history.index + history[0].length;
    const current = CURRENT_CONTEXT.exec(clause.slice(backgroundEnd));
    if (current) clause = clause.slice(backgroundEnd + current.index);
    else if (nextCancelsProposal && history === priorIntent && CHANGE.test(clause.slice(backgroundEnd))) canceledProposal = true;
    else {
      const earlier = clause.slice(0, history.index).trimEnd();
      if (!CURRENT_CONTEXT.test(earlier)) return [];
      clause = earlier;
    }
  }
  const protectedStatement = PROTECTED.test(clause) && (mode === 'revision' || !EXPLICIT_CONTINUATION.test(clause));
  const referenceOnly = REFERENCE_ARTIFACT.test(clause) && !ADOPTED_REFERENCE.test(clause);
  if (!clause || protectedStatement ||
    UNAPPROVED_WITHDRAWAL.test(clause) || CANCEL_PROPOSED_CHANGE.test(clause)) return [];
  const colorQuote = colorCondition && segment.startsWith(clause) ? colorCondition + clause : clause;
  const reported = REPORTED_QUESTION.exec(clause);
  const question = reported && !/(?:得|要|需)(?:先)?等(?:待)?.{0,12}$/.test(clause.slice(0, reported.index)) ? reported : null;
  const action = question ? clause.slice(question.index + question[0].length).trimStart() : clause;
  const newRequirement = question ? PROPOSED_REQUIREMENT.exec(action)?.[1] : undefined;
  const directive = newRequirement ?? action;
  const change = CHANGE.exec(directive) ?? (question ? reportedSwap(directive, inheritsStage) : null);
  const changeLead = change ? directive.slice(0, change.index) : '';
  const wrappedChange = change && /^(?:把|将).{1,16}$/.test(changeLead);
  if (question && (EVIDENCE_DOCUMENT.test(directive) || !newRequirement && !wrappedChange && !PROPOSED_ACTION.test(action))) return [];
  const proposal = Boolean(question) || canceledProposal || PREFERENCE.test(changeLead) || TENTATIVE_CHANGE.test(changeLead);
  const canSelectColor = colorContinuation !== null && clause === segment && !proposal && !change;
  const negativeChange = /(?:不要|不能|不得|不许|别|不)(?:再)?(?:(?:把|将|从).{0,12})?$/.test(changeLead);
  const offset = change ? change.index + change[0].length : 0;
  const target = directive.slice(offset);
  const matchesByField = locateRequirementValues(target, inheritsStage);
  const craftMatches = matchesByField.find(({ field }) => field === 'craft')?.matches ?? [];
  const replacedCrafts = change && !negativeChange && !proposal && craftMatches.length
    ? patternsFor('craft', changeLead).filter(({ value }) => !craftMatches.some((next) => next.value === value)) : [];
  const recognized = matchesByField.flatMap(({ field, matches }) => matches.map(({ start, end }) => ({ field, start, end })));
  const fields = matchesByField.map(({ field, matches }) => {
    const hint = fieldMentions[field];
    const term = !matches.length ? field === 'color' ? UNMAPPED_COLOR.exec(target) : unmappedGarmentTerm(field, target) : null;
    const mentions = !matches.length && hint ? [...target.matchAll(new RegExp(hint.source, 'g'))] : [];
    if (term) {
      if (field === 'color') mentions.unshift(term);
      else mentions.push(term);
    }
    const mention = mentions.find((item) =>
      !recognized.some(({ start, end }) => start <= item.index && end >= item.index + item[0].length),
    );
    return { field, matches, mention, unmapped: term !== null };
  });
  const anchors = [...recognized, ...fields.flatMap(({ field, mention }): LocatedField[] => mention
    ? [{ field, start: mention.index, end: mention.index + mention[0].length }] : [])]
    .sort((left, right) => left.end - right.end);
  const observations: Observation[] = [];
  for (const { field, matches, mention, unmapped } of fields) {
    if (referenceOnly && field !== 'color') continue;
    if (field === 'quantity' && !matches.length && ALLOCATION_SPLIT.test(target)) {
      observations.push(unresolved(field, clause, '各款或各组的分配数量仍需确认。'));
      continue;
    }
    if (field === 'craft') {
      observations.push(...replacedCrafts.map(({ value, start }) => ({
        ...unresolved(field, clause, WITHDRAWAL_REASON),
        withdraws: predicateFor(field, value, NEGATION.test(changeLead.slice(0, start))),
      })));
    }
    if (!matches.length && mention) {
      const start = mention.index;
      const end = start + mention[0].length;
      const { prefix, trailing, statusScope } = nearbyLanguage(target, { field, start, end }, anchors);
      const colorPrefix = (change?.[0] ?? '') + prefix;
      const authority = field === 'color' ? colorRequestPrefix(colorPrefix, trailing, referenceOnly, FORBIDDEN_AFTER.test(trailing)) : prefix;
      if (authority === null || field === 'color' && reportsColorQuestion(colorPrefix)) continue;
      const directColorChoice = field === 'color' && unmapped && canSelectColor && isDirectColorChoice(target, start, end);
      const continuation = directColorChoice ? colorContinuation ?? '' : '';
      if (WITHDRAWAL.test(statusScope)) observations.push(unresolved(field, clause, WITHDRAWAL_REASON));
      else if (REFERENCE_ONLY.test(statusScope)) observations.push(unresolved(field, clause, REFERENCE_REASON));
      else if (field === 'color' && unmapped && (continuation ||
        isUnsettledColor(clause, changeLead + colorPrefix, trailing, Boolean(colorCondition), false))) {
        observations.push(unresolved(field, colorQuote + continuation, PENDING_COLOR_REASON));
      } else if (isUnsettled(statusScope)) observations.push(unresolved(field, clause, UNSETTLED_REASON, !OPEN_QUESTION.test(statusScope) && MANDATORY.test(statusScope)));
      else if (directColorChoice || explicitlyRequired(authority, trailing, statusScope) || unmapped && !question && !proposal &&
        !PREFERENCE.test(statusScope) && !PERMITTED_BEFORE.test(prefix) && !PERMITTED_AFTER.test(trailing) &&
        (field !== 'color' || CHOOSE_COLOR.test(authority) || !trailing && (!authority.trim() || /^(?:颜色|色系|配色|主色)$/.test(authority)))) {
        observations.push(unresolved(field, clause, '原话包含目录规则暂不能归一化的要求。', true));
      } else if (field === 'color' && unmapped && (PREFERENCE.test(authority) || PREFERENCE_AFTER.test(trailing))) {
        observations.push(unresolved(field, clause, UNMAPPED_COLOR_PREFERENCE));
      }
      continue;
    }
    const fieldObservations = matches.map(({ value, start, end }): Observation | null => {
      const { prefix: context, suffix, trailing, statusScope } = nearbyLanguage(target, { field, start, end }, anchors);
      const colorPrefix = (change?.[0] ?? '') + context;
      const prefix = field === 'color' ? colorRequestPrefix(colorPrefix, trailing, referenceOnly,
        FORBIDDEN_AFTER.test(trailing) || CONFIRMED_AFTER.test(trailing)) : context;
      if (prefix === null || field === 'color' && reportsColorQuestion(colorPrefix)) return null;
      const approval = CONFIRMED_BEFORE.exec(prefix);
      const beforeApproval = approval ? prefix.slice(0, approval.index) : '';
      const confirmationPending = REVIEW_DEPENDENCY.test(beforeApproval);
      const proposedApproval = PROPOSES_CONFIRMATION.test(beforeApproval);
      const confirmed = Boolean(approval) && !confirmationPending && !proposedApproval || CONFIRMED_AFTER.test(trailing);
      const tried = SAMPLE_BEFORE.test(prefix) || SAMPLE_AFTER.test(trailing);
      const directColorChoice = field === 'color' && canSelectColor && isDirectColorChoice(target, start, end);
      const continuation = directColorChoice ? colorContinuation ?? '' : '';
      if (field === 'color' && (continuation || isUnsettledColor(clause, changeLead + colorPrefix, trailing, Boolean(colorCondition), confirmed))) {
        return unresolved(field, colorQuote + continuation, PENDING_COLOR_REASON);
      }
      if (!confirmed && (REFERENCE_ONLY.test(statusScope) || tried && !FORBIDDEN_AFTER.test(trailing))) {
        return unresolved(field, clause, REFERENCE_REASON);
      }
      if (WITHDRAWAL.test(statusScope)) {
        const excluded = NEGATION.test(prefix) && !/不用(?:把|将)\s*$/.test(prefix);
        return { ...unresolved(field, clause, WITHDRAWAL_REASON), withdraws: predicateFor(field, value, excluded) };
      }
      const openQuestion = OPEN_QUESTION.test(statusScope);
      const mandatory = !proposal && !proposedApproval && !openQuestion && (confirmed || MANDATORY.test(prefix) || MANDATORY.test(suffix));
      const boundedQuantity = field === 'quantity' && /至少|至多|不超过|不少于|超过|以上|以下|[套件身]起/.test(statusScope);
      const amountStart = clause.length - target.length + start;
      const amountEnd = clause.length - target.length + end;
      const quantityScope = field === 'quantity' ? (isBatchQuantity(clause, amountStart, amountEnd) ? 'batch' : 'order') : undefined;
      if (field === 'quantity' && isSampleQuantity(clause, amountStart, amountEnd)) {
        return unresolved(field, clause, '原话记录了样衣安排，正式成衣订量待确认。');
      }
      if ((confirmationPending || isUnsettled(statusScope) ||
        field === 'quantity' && isTentativeQuantity(clause, amountStart, amountEnd)) && !confirmed || boundedQuantity) {
        return {
          ...unresolved(field, clause, UNSETTLED_REASON, mandatory || boundedQuantity),
          ...(quantityScope ? { quantityScope } : {}),
        };
      }
      const explicitComposition = field === 'fabric' && /\d[\d.]*\s*(?:%|％)|百分之[零一二两三四五六七八九十百\d]+|[一二两三四五六七八九]成/.test(statusScope);
      const measuredFit = (field === 'easeAllowance' || field === 'lengthRatio') && /(?:\d|[一二两三四五六七八九十])\s*(?:公分|厘米|毫米|cm\b|mm\b)/i.test(statusScope);
      if ((explicitComposition || measuredFit) && explicitlyRequired(prefix, trailing, statusScope)) {
        return unresolved(field, clause, '原话要求核验具体数值，待人工补证。', true);
      }
      const doubleCareNegative = field === 'care' && /(?:不要|拒绝|不接受|不能用)[^，,；;]{0,8}(?:不能|不可|不支持)\s*$/.test(prefix);
      const exclusiveCareExcluded = field === 'care' && /(?:不能|不要|拒绝|不接受|避开|不选|谢绝)(?:再)?(?:选|用|买|采用|接受|要)?(?:必须|只能|仅能|只可|仅可|仅限|只允许)\s*$/.test(prefix);
      const trailingPreference = PREFERENCE_AFTER.exec(trailing);
      const permitted = (field !== 'care' && PERMITTED_BEFORE.test(prefix)) || PERMITTED_AFTER.test(trailing);
      const excluded = !doubleCareNegative && (negativeChange || NEGATION.test(prefix) || field === 'scene' && excludesVenue(prefix) || FORBIDDEN_AFTER.test(trailing) ||
        field === 'color' && prefix !== context && /不(?:按|照)(?:着)?\s*$/.test(prefix) ||
        Boolean(trailingPreference?.[1]) || exclusiveCareExcluded);
      const preferred = !directColorChoice && PREFERENCE.test(prefix) || proposal || proposedApproval || /偏(?:向)?\s*$/.test(prefix) || trailingPreference !== null;
      if (mode === 'initial' && permitted && !preferred && !mandatory && !excluded) {
        return unresolved(field, clause, REFERENCE_REASON);
      }
      const directOrder = /(?<!不)(?:想|希望)要?(?:(?:照|按)(?:着)?(?:我(?:们)?(?:的)?|自己(?:的)?)(?:尺寸|身材|尺码|量体))?(?:定制|定做|订做|做)/
        .test(prefix + target.slice(start, end));
      const orderField = field === 'category' || field === 'quantity' || field === 'businessType';
      const level = !mandatory && ((preferred || permitted) && !(orderField && directOrder && !proposal) ||
        (!change && field === 'luster' && /更亮|亮一点|亮一些/.test(statusScope)))
        ? 'preference' : 'hard';
      const explicitColorChoice = field === 'color' && (directColorChoice || CHOOSE_COLOR.test(prefix));
      return { field, ...predicateFor(field, value, excluded), level, reason: null, quote: clause,
        ...(quantityScope ? { quantityScope } : {}),
        ...((confirmed || explicitColorChoice) && level === 'hard' && !excluded ? { resolvesPending: true } : {}),
      };
    });
    const alternatives = new Set<number>();
    for (let index = 1; index < matches.length; index++) {
      const left = matches[index - 1];
      const right = matches[index];
      const leftObservation = fieldObservations[index - 1];
      const rightObservation = fieldObservations[index];
      if (!leftObservation || !rightObservation) continue;
      const gap = target.slice(left.end, right.start).trim();
      if (left.value === right.value || !ALTERNATIVE.test(gap) || !COORDINATOR.test(gap)) continue;
      if (leftObservation.op === 'neq' && rightObservation.op === 'neq') continue;
      alternatives.add(index - 1);
      alternatives.add(index);
    }
    observations.push(...fieldObservations.filter((item, index): item is Observation => item !== null && !alternatives.has(index)));
    if (alternatives.size) {
      const indexes = [...alternatives];
      const confirmedLater = fieldObservations.slice(indexes.at(-1)! + 1).some((item) => item?.resolvesPending);
      if (!confirmedLater) {
        const tentativeColor = field === 'color' && indexes.every((index) => fieldObservations[index]?.reason === PENDING_COLOR_REASON);
        observations.push(unresolved(field, field === 'color' ? colorQuote : clause,
          tentativeColor ? PENDING_COLOR_REASON : '原话列出多个备选，需要确认取值。',
          !tentativeColor && indexes.some((index) => MANDATORY.test(nearbyLanguage(target, { field, ...matches[index] }, anchors).prefix))));
      }
    }
  }
  return observations;
}

const NAMED_REJECTION = new RegExp(`^(?:(?:前面|上面|刚(?:才)?|先前|此前|之前)(?:提到|提过|提|说到|说过|说|选过|选|看过)|前述|上述)(?:的)?\\s*(?:[这那](?:个|项|种|条|款))?\\s*([\\p{Script=Han}]{1,6})\\s*${REJECTION_PREDICATE}`, 'u');
const OTHER_ORDER = /(?:另(?:一|一笔|一个)|其他|其它|别的|上(?:一)?|前一|下一|旧)(?:单|订单|工单|件)/u;
const referenceLabels: Partial<Record<ConstraintField, RegExp>> = {
  color: /^(?:颜色|配色|色彩|色调|主色)$/, fabric: /^(?:布料|材质|用料)$/, collar: /^(?:领型|领口|领子)$/,
  care: /^(?:洗护方式|洗标|清洗方式)$/, season: /^季节$/, lengthRatio: /^(?:衣长|裙长)$/,
  patternStructure: /^(?:版型|廓形)$/, closure: /^(?:开合|门襟)$/, style: /^风格$/,
};

function readReferencedExclusions(text: string, previous: RequirementClause, current: RequirementClause): Observation[] {
  if (!PAIRED_REJECTION.test(current.text) || !/^[\s，,；;。！？!?]*$/u.test(text.slice(previous.end, current.start))) return [];
  const groups = locateRequirementValues(previous.text).filter(({ matches }) => matches.length > 0);
  if (groups.length !== 1 || groups[0].matches.length !== 2) return [];
  const { field, matches: [first, second] } = groups[0];
  if (first.value === second.value || !COORDINATOR.test(previous.text.slice(first.end, second.start).trim())) return [];
  const prefix = previous.text.slice(0, first.start);
  const trailing = trailingStance(previous.text.slice(second.end).trim(), field);
  if ((!SAMPLE_BEFORE.test(prefix) && !SAMPLE_AFTER.test(trailing)) ||
    explicitlyRequired(prefix, trailing, previous.text) || CONFIRMED_AFTER.test(trailing)) return [];
  const quote = text.slice(previous.start, current.end);
  return [first, second].map(({ value }) => ({ field, ...predicateFor(field, value, true), level: 'hard', quote, reason: null }));
}

function readNamedExclusion(text: string, clauses: RequirementClause[], currentIndex: number, mode: 'initial' | 'revision'): ReferenceExclusion[] {
  const current = clauses[currentIndex];
  const label = NAMED_REJECTION.exec(current.text)?.[1];
  if (!label) return [];
  const field = requirementFieldIds.find((id) => requirementFields[id].label === label || referenceLabels[id]?.test(label));
  if (!field) return [];

  const start = field === 'color' ? currentIndex + 1 - activeOrderClauses(clauses.slice(0, currentIndex + 1)).length : 0;
  let sentenceBoundaries = 0;
  let source: { index: number; value: FieldMatch['value']; level: Observation['level'] } | undefined;
  let unlistedColorIndex: number | undefined;
  let unlistedColorMentions = 0;
  let hasCatalogColor = false;
  for (let index = currentIndex - 1; index >= start; index--) {
    const previous = clauses[index];
    const boundary = text.slice(previous.end, clauses[index + 1].start);
    if (!/^[\s，,；;。！？!?]+$/u.test(boundary) || /\r?\n[ \t]*\r?\n/u.test(boundary)) break;
    if (/[。！？!?\n]/u.test(boundary) && ++sentenceBoundaries > 1) break;
    if (field === 'color' && (HISTORICAL_LEAD.test(previous.text) || HISTORICAL_ORDER.test(previous.text) ||
      OTHER_ORDER.test(previous.text))) break;
    const beforePrevious = clauses[index - 1];
    const condition = colorConditionBefore(text, beforePrevious, previous);
    const continuation = directColorChoiceContinuation(text, beforePrevious, previous, clauses[index + 1], namesColor);
    const observations = readSegment(previous.text, mode, false, false, condition, continuation);
    if (field === 'color') {
      const catalog = patternsFor('color', previous.text);
      hasCatalogColor ||= catalog.length > 0;
      for (const mention of previous.text.matchAll(new RegExp(UNMAPPED_COLOR.source, 'gu'))) {
        if (catalog.some(({ start, end }) => start < mention.index + mention[0].length && end > mention.index)) continue;
        unlistedColorMentions++;
        if (observations.some((item) => item.field === 'color' && item.value === null && item.reason !== WITHDRAWAL_REASON) ||
          HISTORICAL_INTENT.test(previous.text.slice(0, mention.index))) unlistedColorIndex = index;
      }
    }
    for (const { field: candidateField, op, value, level } of observations) {
      if (candidateField !== field || op !== 'eq' || value === null) continue;
      if (source && source.value !== value) return [];
      source ??= { index, value, level };
    }
  }
  if (unlistedColorIndex !== undefined) {
    if (unlistedColorMentions !== 1 || hasCatalogColor) return [];
    return [{ observation: unresolved(field, text.slice(clauses[unlistedColorIndex].start, current.end),
      '原话排除的颜色暂不能归一化，需要人工核对。', true) }];
  }
  if (!source) return [];
  const { index, value, level } = source;
  return [{
    observation: { field, ...predicateFor(field, value, true), level: 'hard', reason: null, quote: text.slice(clauses[index].start, current.end) },
    ...(level === 'preference' ? { supersedes: { clauseIndex: index, value } } : {}),
  }];
}

// A neighboring color reference is supporting evidence, independent of the request that blocks matching.
function withAdjacentColorReference(text: string, clauses: RequirementClause[], blocker: string, open: Constraint[]): string {
  const references = open.filter((item) => item.reason === REFERENCE_REASON && item.quote);
  if (!references.length || OTHER_ORDER.test(blocker) || !UNMAPPED_COLOR.test(blocker) || patternsFor('color', blocker).length) return blocker;
  const active = activeOrderClauses(clauses);
  const index = active.findIndex((clause) => clause.text === blocker);
  if (index < 0 || clauses.filter((clause) => clause.text === blocker).length !== 1) return blocker;

  const current = active[index];
  for (const neighbor of [active[index - 1], active[index + 1]]) {
    if (!neighbor || !references.some((item) => item.quote === neighbor.text) ||
      OTHER_ORDER.test(neighbor.text) || !namesColor(neighbor.text) ||
      !/(?:可(?:以)?(?:先)?参考|(?:只|仅)(?:供|作(?:为)?|当作)?参考)/u.test(neighbor.text)) continue;
    const [first, last] = neighbor.start < current.start ? [neighbor, current] : [current, neighbor];
    if (/^[，,；;。 \t]+$/u.test(text.slice(first.end, last.start)) && clauses.filter((clause) => clause.text === neighbor.text).length === 1) {
      return text.slice(first.start, last.end);
    }
  }
  return blocker;
}

type ConstraintPredicate = Pick<Constraint, 'field' | 'op' | 'value'> & Partial<Pick<Constraint, 'quote' | 'quantityScope'>>;

export function sameQuantityScope(left: ConstraintPredicate, right: ConstraintPredicate): boolean {
  if (left.field !== 'quantity' || right.field !== 'quantity' ||
      typeof left.value !== 'number' || typeof right.value !== 'number') return true;
  return quantityScopeOf(left) === quantityScopeOf(right);
}

export function constraintPredicatesConflict(left: ConstraintPredicate, right: ConstraintPredicate): boolean {
  if (!sameQuantityScope(left, right)) {
    if (left.op !== 'eq' || right.op !== 'eq' || typeof left.value !== 'number' || typeof right.value !== 'number') return false;
    const leftIsBatch = quantityScopeOf(left) === 'batch';
    const batchValue = leftIsBatch ? left.value : right.value;
    const totalValue = leftIsBatch ? right.value : left.value;
    if (batchValue <= totalValue) return false;
    const batchUnit = orderQuantityUnit(batchValue, (leftIsBatch ? left.quote : right.quote) ?? '', 'batch');
    const totalUnit = orderQuantityUnit(totalValue, (leftIsBatch ? right.quote : left.quote) ?? '', 'order');
    return Boolean(batchUnit && batchUnit === totalUnit);
  }
  if (left.field === 'scene' && right.field === 'scene' && left.value !== null && right.value !== null) {
    const named = [left, right].find((item) => SCENES.some(({ id }) => id === item.value));
    if (named) {
      const other = named === left ? right : left;
      const fits = sceneFits(String(named.value), String(other.value));
      if (named.op === 'eq') return fits !== undefined && (other.op === 'eq' ? !fits : fits);
      return other.op === 'eq' && named.value === other.value;
    }
  }
  return left.field === right.field && left.value !== null && right.value !== null && (
    left.field !== 'craft' && left.op === 'eq' && right.op === 'eq' && left.value !== right.value ||
    left.op !== right.op && left.value === right.value
  );
}

export function constraintsConflict(left: Constraint, right: Constraint): boolean {
  return left.level === 'hard' && right.level === 'hard' && constraintPredicatesConflict(left, right);
}

export function hasQuantityScopeConflict(constraints: Constraint[]): boolean {
  const amounts = constraints.filter((item) => item.field === 'quantity' && item.level === 'hard' && item.op === 'eq');
  return amounts.some((left, index) => amounts.slice(index + 1).some((right) =>
    !sameQuantityScope(left, right) && constraintsConflict(left, right)));
}

export function applyConstraintEdit(constraints: Constraint[], item: Constraint): Constraint[] {
  const edited = constraints.flatMap((constraint) => {
    if (constraint.id === item.id) return [item];
    if (constraint.field !== item.field) return [constraint];
    if (!sameQuantityScope(constraint, item) ||
      isIndependentQuantityReview(constraint, item) || isIndependentQuantityReview(item, constraint)) return [constraint];
    if (constraint.state === 'unknown' || item.state === 'unknown' ||
      constraintPredicatesConflict(constraint, item) || constraint.value === item.value) return [];
    return [constraint];
  });
  if (item.field === 'quantity' && hasQuantityScopeConflict(edited)) {
    edited.push({
      id: 'edit:quantity:scope-conflict', field: 'quantity', op: 'eq', value: null, state: 'unknown',
      level: 'pending', sourceTurnId: null, quote: null, verifiedBy: null, blocking: true,
      reason: '本批订量超过同单位的整单数量，请核对两项数值。',
    });
  }
  return edited;
}

function standaloneGarment(item: Constraint, observations: Constraint[]): boolean {
  if (item.field !== 'category' || item.value !== 'jacket' && item.value !== 'dress' || item.op !== 'eq' || !item.quote) return true;
  const localFields = observations.filter((other) => other.quote === item.quote && other.value !== null);
  const localOutfit = localFields.some(({ field, op, value }) =>
    (field === 'category' || field === 'patternStructure') && op === 'eq' && value === 'two_piece');
  if (localOutfit && new RegExp(GARMENT_COMPONENT_PAIR).test(item.quote)) return false;
  if (localFields.some(({ field }) => field === 'quantity')) return true;
  const componentDescription = /^(?:这套的|其中的?|套装的|演出服的|配套的?)?(?:外套|夹克|上衣|下装|长裙|连衣裙|连身裙)(?:的)?(?=颜色|配色|袖|领|下摆|衣长|裙长|面料|洗护|采用|用|选|定|控制|换|改|做|需|应|必须|要|只|建议)/;
  if (!componentDescription.test(item.quote)) return true;
  return !localFields.some(({ field }) =>
    ['collar', 'lengthRatio', 'fabric', 'color', 'luster', 'closure', 'motif', 'style', 'craft', 'easeAllowance', 'care'].includes(field));
}

export function extractRevisionConstraints(turn: RequirementTurn, mode: 'initial' | 'revision' = 'revision'): Constraint[] {
  const segments = splitRequirementClauses(turn.text);
  const clauses = mode === 'initial' ? activeOrderClauses(segments) : segments;
  const references = clauses.map((clause, index): ReferenceExclusion[] => index > 0 ? [
    ...readReferencedExclusions(turn.text, clauses[index - 1], clause).map((observation) => ({ observation })),
    ...readNamedExclusion(turn.text, clauses, index, mode),
  ] : []);
  const supersededPreferences = references.flat().filter(({ supersedes }) => supersedes);
  let stageStart: number | null = null;
  const observations = clauses.flatMap((clause, index) => {
    const previous = clauses[index - 1];
    const next = clauses[index + 1];
    const nextCancelsProposal = mode === 'revision' && Boolean(next && CANCEL_PROPOSED_CHANGE.test(next.text) &&
      /^[，,；;。！？!? \t]+$/u.test(turn.text.slice(clause.end, next.start)));
    const hasSubject = namesStageSubject(clause.text);
    const continuesStage = stageStart !== null && !hasSubject && stageLocations(clause.text, true).length > 0;
    const colorCondition = colorConditionBefore(turn.text, previous, clause);
    const colorContinuation = directColorChoiceContinuation(turn.text, previous, clause, next, namesColor);
    const found = readSegment(clause.text, mode, continuesStage, nextCancelsProposal, colorCondition, colorContinuation).filter((item) =>
      !(item.value === null && references[index].some(({ observation }) => observation.field === item.field)) &&
      (item.reason !== REFERENCE_REASON || !references[index + 1]?.some(({ observation }) => observation.field === item.field)) &&
      !(item.level === 'preference' && item.op === 'eq' && supersededPreferences.some(({ observation, supersedes }) =>
        observation.field === item.field && supersedes?.clauseIndex === index && supersedes.value === item.value)));
    const organizationEvidence = mode === 'initial' && found.find(({ field, value }) => field === 'businessType' && value === 'corporate_uniform');
    if (organizationEvidence && organizationEvidence.quote === clause.text) {
      const buyerRoles = clauses.slice(index + 1, index + 3);
      if (buyerRoles.length === 2 && buyerRoles.every(({ text }) => /^(?:采购|店长|门店负责人|后勤|行政|主管)[^，,；;。！？!?]{0,6}(?:备注|写|要求|规定|确认|提出)/u.test(text))) {
        organizationEvidence.quote = turn.text.slice(clause.start, buyerRoles[1].end);
      }
    }
    const tentativeColor = found.find(({ field, reason }) => field === 'color' && reason === PENDING_COLOR_REASON);
    if (tentativeColor && next && /^[，,；; \t]+$/u.test(turn.text.slice(clause.end, next.start)) &&
      fieldMentions.color?.test(next.text) && isUnsettled(next.text) && !namesColor(next.text)) {
      const start = tentativeColor.quote?.startsWith(colorCondition) ? clause.start - colorCondition.length : clause.start;
      if (tentativeColor.quote === turn.text.slice(start, clause.end)) tentativeColor.quote = turn.text.slice(start, next.end);
    }
    if (continuesStage && stageStart !== null) {
      for (const observation of found) {
        if (observation.field === 'scene') observation.quote = turn.text.slice(stageStart, clause.end);
      }
    } else {
      const describesPerformance = found.some(({ field, value }) => field === 'scene' &&
        (value === 'outdoor_stage' || value === 'indoor_performance' || value === 'scene-outdoor-stage'));
      stageStart = describesPerformance || hasSubject && !stageLocations(clause.text).length ? clause.start : null;
    }
    found.push(...references[index].map(({ observation }) => observation));
    if (!previous || !/^(?:每(?:一)?[个名人位]|一[人位]|人[均手]|各)/u.test(clause.text) ||
      !/^[，,；;\s]+$/u.test(turn.text.slice(previous.end, clause.start))) return found;
    const source = turn.text.slice(previous.start, clause.end);
    const allocation = matchPerPersonQuantity(source);
    if (!allocation || allocation.start >= clause.start - previous.start) return found;
    return [...found.filter(({ field }) => field !== 'quantity'),
      ...readSegment(source, mode).filter(({ field }) => field === 'quantity')];
  });
  const laterConfirmations = new Set<ConstraintField>();
  const constraints: Constraint[] = [];
  for (let index = observations.length - 1; index >= 0; index--) {
    const { resolvesPending, ...observation } = observations[index];
    if (resolvesPending) laterConfirmations.add(observation.field);
    if (observation.level === 'pending' && !observation.blocking && observation.reason !== WITHDRAWAL_REASON &&
      laterConfirmations.has(observation.field)) continue;
    constraints.push({
      ...observation,
      id: `${turn.id}:${observation.field}:${index + 1}`,
      state: observation.level === 'pending' ? 'unknown' : 'explicit',
      sourceTurnId: turn.id,
      verifiedBy: null,
    });
  }
  constraints.reverse();
  const twoPieceOrder = constraints.some(({ field, op, value }) =>
    (field === 'category' || field === 'patternStructure') && op === 'eq' && value === 'two_piece');
  return requirementFieldIds.flatMap((field) => {
    let items = constraints.filter((constraint) => constraint.field === field && (!twoPieceOrder || standaloneGarment(constraint, constraints)));
    if (field === 'quantity' && items.some(({ op, quote }) => op === 'eq' && /^(?:而)?是/.test(quote ?? ''))) {
      items = items.filter(({ op, quote }) => op !== 'neq' || !/(?:不是|并非)(?:要|订|做)?/.test(quote ?? ''));
    }
    const isScopedWithdrawal = (item: Constraint) => field === 'quantity' && Boolean(namedQuantityScope(item.quote ?? ''));
    const withdrawalIndex = items.findLastIndex((item) => isExplicitWithdrawal(item) && !item.withdraws && !isScopedWithdrawal(item));
    if (withdrawalIndex >= 0) {
      const after = items.slice(withdrawalIndex + 1);
      if (!after.some(({ value }) => value !== null)) return [items[withdrawalIndex]];
      items = after;
    }
    const withdrawals = items.filter((item, index) => isExplicitWithdrawal(item) && (item.withdraws || isScopedWithdrawal(item)) &&
      !items.slice(index + 1).some((next) => targetsWithdrawal(item, next) ||
        item.withdraws && next.withdraws?.op === item.withdraws.op && next.withdraws.value === item.withdraws.value));
    const concrete = items.filter((item, index) => item.value !== null && !items.slice(index + 1).some((next) =>
      isExplicitWithdrawal(next) && targetsWithdrawal(next, item)));
    const conflicts = concrete.some((left, index) => concrete.slice(index + 1).some((right) => constraintsConflict(left, right)));
    if (conflicts) return [...withdrawals, ...concrete.filter(({ level }) => level === 'hard'), {
      ...items[0], id: `${turn.id}:${field}:conflict`, value: null, op: 'eq', level: 'pending', state: 'unknown',
      quote: turn.text.trim(), reason: '同一轮原话包含互相冲突的要求，需要人工确认。', blocking: true, quantityScope: undefined,
    } satisfies Constraint];
    const hasChosenValue = concrete.some((item) => item.op === 'eq');
    const open = items.filter((item) => item.state === 'unknown' && !isExplicitWithdrawal(item) &&
      (item.reason !== REFERENCE_REASON || !hasChosenValue));
    let pending = open.at(-1);
    if (field === 'color') {
      const blockers = open.filter(({ blocking }) => blocking);
      pending = blockers[0] ?? open.findLast(({ reason }) => reason === PENDING_COLOR_REASON) ?? pending;
      // Unknown values share one field slot. Preserve all blocking color requests in one verbatim span.
      const firstQuote = blockers[0]?.quote;
      const lastQuote = blockers.at(-1)?.quote;
      if (pending && blockers.length > 1 && firstQuote && lastQuote) {
        const start = turn.text.indexOf(firstQuote, clauses[0].start);
        const end = turn.text.lastIndexOf(lastQuote) + lastQuote.length;
        pending = { ...pending, quote: turn.text.slice(start, end) };
      } else if (pending && blockers.length === 1 && firstQuote) {
        pending = { ...pending, quote: withAdjacentColorReference(turn.text, clauses, firstQuote, open) };
      }
    }
    const distinct = concrete.filter((item, index) => !concrete.slice(index + 1).some((other) =>
      other.op === item.op && other.value === item.value && sameQuantityScope(item, other) && (other.level === item.level || other.level === 'hard')))
      .filter((item) => item.level === 'hard' || !concrete.some((other) =>
        other.op === item.op && other.value === item.value && sameQuantityScope(item, other) && other.level === 'hard'));
    return [...withdrawals, ...distinct, ...(pending ? [pending] : [])];
  });
}

const sceneContext: Partial<Record<string, string>> = {
  'scene-bund-protocol': 'indoor_formal',
  'scene-lujiazui-summit': 'indoor_formal',
  'scene-outdoor-stage': 'outdoor_stage',
  'scene-bund-banquet': 'formal_evening',
};

const presetSuggestions: Readonly<Record<string, Partial<Record<ConstraintField, NonNullable<Constraint['value']>>>>> = {
  'official-case-6': {
    patternStructure: 'h_line', collar: 'cross_open', fabric: 'silk', motif: 'subtle_jacquard',
    lengthRatio: 'mid_hip', closure: 'no_visible_buttons', care: 'dry_clean', luster: 'medium',
    craft: 'crf-cross-collar-no-button',
  },
  'official-case-3': {
    collar: 'diagonal', fabric: 'silk', color: 'ivory_rose', motif: 'subtle_jacquard',
    lengthRatio: 'ankle', luster: 'high', style: 'new_chinese', craft: 'crf-contrast-piping-cuff',
  },
  'official-case-1': {
    patternStructure: 'h_line', collar: 'stand', fabric: 'acetate', motif: 'subtle_jacquard',
    lengthRatio: 'mid_hip', closure: 'no_visible_buttons', care: 'dry_clean', luster: 'medium',
    style: 'new_chinese', craft: 'crf-low-collar-ergo',
  },
  'official-case-2': {
    patternStructure: 'h_line', collar: 'lapel', fabric: 'blend', lengthRatio: 'mid_hip',
    care: 'dry_clean', luster: 'medium', style: 'new_chinese', craft: 'crf-plum-starlight-motif',
  },
  'official-case-4': {
    patternStructure: 'h_line', collar: 'stand', fabric: 'silk', motif: 'plain',
    lengthRatio: 'mid_hip', closure: 'no_visible_buttons', luster: 'low',
    style: 'new_chinese', craft: 'crf-low-collar-ergo',
  },
  'demo-corporate-haipai-uniform': {
    category: 'suit', patternStructure: 'two_piece', fabric: 'wool', motif: 'plain',
    easeAllowance: 'arm_mobility', closure: 'no_visible_buttons', care: 'dry_clean',
    luster: 'medium', craft: 'crf-full-canvas-guiba',
  },
  'demo-haipai-evening-gown': {
    fabric: 'blend', lengthRatio: 'floor', care: 'dry_clean', luster: 'high', style: 'new_chinese',
  },
};

const questions: Partial<Record<ConstraintField, string>> = {
  care: '是否必须机洗，还是可以接受其他洗护方式？',
  scene: '主要在什么场合穿着？例如室内正式会务或户外演出。',
  quantity: '需要订做多少成衣？请注明单位。',
  category: '想定制外套、套装，还是礼服？',
  color: '有哪些指定或排除的色系？',
};

export function buildClarificationQuestions(constraints: Constraint[]): ClarificationQuestion[] {
  const outstanding = constraints.filter((item) => item.state === 'unknown' && item.sourceTurnId !== null && !isExplicitWithdrawal(item))
    .sort((left, right) => Number(Boolean(right.blocking)) - Number(Boolean(left.blocking)));
  const fields = new Set<ConstraintField>(outstanding.map(({ field }) => field));
  const group = constraints.some((item) => item.field === 'businessType' && item.op === 'eq' && item.value === 'corporate_uniform');
  const priorities = group ? ['care', 'scene', 'quantity'] as const : ['category'] as const;
  for (const field of priorities) {
    if (!constraints.some((item) => item.field === field && (item.state === 'explicit' || item.state === 'confirmed' || isExplicitWithdrawal(item)))) fields.add(field);
  }
  return [...fields].slice(0, 2).map((field) => {
    const quote = field === 'quantity' ? outstanding.find((item) => item.field === field)?.quote ?? '' : '';
    const quantityQuestion = ALLOCATION_SPLIT.test(quote) ? '各款或各组分别需要多少成衣？请注明单位。'
      : TOTAL_QUANTITY_SCOPE.test(quote) ? '整单累计需要多少成衣？请注明单位。'
        : BATCH_QUANTITY_SCOPE.test(quote) ? '本批需要多少成衣？请注明单位。' : undefined;
    return { field, question: quantityQuestion ?? questions[field] ?? `请确认${requirementFields[field].label}的具体要求。` };
  });
}

function formAndPresetSuggestions(input: RequirementInput): Partial<Record<ConstraintField, NonNullable<Constraint['value']>>> {
  const formQuantity = parseFormQuantity(input.groupSize);
  const preset = input.presetDemoId ? presetSuggestions[input.presetDemoId] : undefined;
  return {
    businessType: input.businessType,
    season: input.presetDemoId || input.season !== 'all_season' ? input.season : undefined,
    scene: sceneContext[input.targetSceneId],
    quantity: input.presetDemoId && formQuantity ? formQuantity : undefined,
    ...(preset ?? {}),
  };
}

export function buildLocalDecisionRequirement(input: RequirementInput): DecisionRequirement {
  const firstTurn = { id: 'brief-1', text: input.rawNarrative };
  const observations = extractRevisionConstraints(firstTurn, 'initial');
  const suggestions = formAndPresetSuggestions(input);
  const preset = input.presetDemoId ? presetSuggestions[input.presetDemoId] : undefined;
  const constraints = requirementFieldIds.flatMap((field): Constraint[] => {
    const stated = observations.filter((constraint) => constraint.field === field);
    if (stated.length) return stated;
    const value = suggestions[field] ?? null;
    const fromPreset = Boolean(preset && field in preset);
    return [{
      id: `initial:${field}`, field, op: 'eq', value, level: value === null ? 'pending' : 'preference',
      state: value === null ? 'unknown' : 'suggested', sourceTurnId: null, quote: null, verifiedBy: null,
      reason: value === null ? '原话未说明或暂无可归一化的取值。' :
        fromPreset ? '按案例参考建议预填，可随时调整。' : '沿用项目场景信息。',
    }];
  });
  return { schemaVersion: REQUIREMENT_SCHEMA_VERSION, mode: 'local_rules', input, turns: [firstTurn], constraints, questions: buildClarificationQuestions(constraints) };
}
