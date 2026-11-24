import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { SCENES } from '../data/scenes';
import { colorReviewText } from './colorPresentation';
import type {
  ConfigurationState,
  DeconstructedRequirement,
  RequirementInput,
  VisualPromptPack,
} from '../types/sartoria';

const COLOR_EN: Record<string, string> = {
  neutral_silk: 'neutral understated dark tonal silk (placeholder visual tone only, final color pending physical swatch selection)',
  obsidian: 'deep obsidian charcoal black with subtle tonal jacquard',
  ivory: 'luminous moonlight ivory with pale misty celadon sheen',
  crimson: 'deep burgundy crimson velvet with dark floral jacquard luster',
  navy: 'deep Bund midnight navy worsted twill',
  stone_gray: 'warm misty silver-charcoal gray',
  pine_green: 'deep refined Shanghai pine-ink forest green worsted wool',
  champagne: 'luminous champagne pearl heavy silk crepe satin',
  mist_blue: 'tranquil dusk mist indigo blue silk jacquard',
  ivory_rose: 'ivory white jacquard jacket trimmed with vibrant rose-pink silk piping and matching vibrant rose-pink lustrous satin dress',
  earth_brown: 'authentic matte dark earth-brown Gambiered Canton silk (Xiangyunsha)',
};

const WEAVE_EN: Record<string, string> = {
  真丝暗纹织花: 'fine tonal micro-floral jacquard mulberry silk weave',
  薄款醋酸提花锦: 'lightweight matte triacetate silk jacquard weave',
  宋锦重纬提花: 'Song Brocade silk jacquard weave',
  缎纹暗花织锦: 'Suzhou silk damask jacquard weave',
  香云纱自然肌理: 'authentic matte organic-crinkle Gambiered Canton silk (Xiangyunsha)',
  提花烂花丝绒: 'burnt-out floral silk velvet weave',
  精纺斜纹呢: 'fine diagonal worsted wool twill',
  平纹混纺精纺: 'fine worsted wool-mulberry silk blend',
  高密弹力斜纹: 'high-density stretch worsted twill',
  重磅精纺人字呢: 'heavyweight cashmere wool herringbone suiting',
};

const SCENE_EN: Record<string, string> = {
  'scene-studio-minimal':
    'minimalist architectural alabaster light-gray gallery studio, clean negative space, CRI 95 diffused museum lighting, Loro Piana editorial lookbook aesthetic',
  'scene-bund-protocol':
    'grand Shanghai neoclassical formal cultural reception hall, travertine limestone columns, warm architectural lighting',
  'scene-outdoor-stage':
    'atmospheric open-air Shanghai heritage garden concert stage at twilight, warm stage spotlights, lush greenery softly blurred in bokeh',
  'scene-jingan-salon':
    'minimalist contemporary Shanghai art gallery salon, warm architectural travertine walls, soft diffused daylight',
  'scene-bund-banquet':
    'grand historic Shanghai Bund heritage mansion banquet hall at night, warm crystal chandeliers, dark walnut paneling, Bund skyline in soft bokeh',
  'scene-lujiazui-summit':
    'grand modern Lujiazui Shanghai financial summit glass atrium, floor-to-ceiling windows with Pudong skyline daylight',
};

const PATTERN_EN: Record<string, string> = {
  jacket_h_cross_collar:
    'minimalist dignified bespoke neo-Chinese H-line straight mid-hip jacket (no waist cinching), softly dropped clean flat shoulders with generous shoulder-back and sleeve armhole ease for a tall broad-shouldered build, smooth cross-collar open front placket with no stand collar and no exposed buttons, subtle side hem vents',
  jacket_h_low_collar:
    'dignified bespoke modern Chinese H-line straight-cut mid-hip jacket (no waist cinching, comfortable relaxed abdominal drape), low rounded Mandarin stand collar under 3cm, gently sloped clean shoulders',
  jacket_h_shawl:
    'refined bespoke relaxed H-line modern Chinese mid-hip jacket with subtle waist shaping and sleek narrow soft shawl lapel collar layered over an ivory silk blouse',
  stage_two_piece:
    'bespoke two-piece concert stage performance ensemble: cropped relaxed micro-H Chinese diagonal-placket jacket with generous sleeve allowance for effortless arm movement, layered over a sleeveless ankle-length wide A-line lustrous satin gown',
  jacket_h_dropped:
    'understated minimalist bespoke modern Chinese H-line straight mid-hip jacket with soft natural dropped shoulders, low rounded Mandarin collar under 3cm, generous relaxed front drape',
  gown_column: 'floor-length bespoke Haipai neo-Chinese evening gown, sleek elongated column-mermaid silhouette',
  gown_cape: 'floor-length bespoke Haipai couture evening gown with sculptural flowing capelet shoulder',
  suit_woman_stand: 'architectural tailored female executive suit with modified Haipai Mandarin stand collar',
  suit_man_double: 'full-canvas double-breasted peak-lapel bespoke Haipai tuxedo suit',
  suit_ensemble:
    'coordinated bespoke corporate tailored suits',
};

const CRAFT_EN_MAP: Record<string, string> = {
  'crf-cross-collar-no-button':
    'clean stand-free cross-collar open front placket with zero exposed buttons and understated small tonal jacquard motif alignment',
  'crf-low-collar-ergo': '3cm rounded low Mandarin stand collar and clean relaxed abdominal drape construction',
  'crf-plum-starlight-motif': 'tonal woven plum blossom floral jacquard accented with ultra-fine microscopic pinpoint starlight glints',
  'crf-contrast-piping-cuff': 'vibrant contrast 3mm silk piping trim along diagonal placket and wide comfortable concert cuffs',
  'crf-haipai-pipa-button': 'handmade silk pipa frog buttons along diagonal placket',
  'crf-suzhou-magnolia-embroidery': 'tonal split-thread Suzhou silk embroidery of white magnolia blossom',
  'crf-full-canvas-guiba': 'hand-shaped full-canvas horsehair chest structure and crisp lapel roll',
  'crf-hidden-mandarin-placket': 'minimalist hidden-placket modified Haipai Mandarin stand collar',
  'crf-milanese-cuff-label': 'working surgeon cuffs with handmade Milanese silk buttonholes',
};

export function generateVisualPromptPack(
  input: RequirementInput,
  deconstructed: DeconstructedRequirement,
  config: ConfigurationState
): VisualPromptPack {
  const pattern = PATTERNS.find((p) => p.id === config.patternId) ?? PATTERNS[0];
  const fabric = FABRICS.find((f) => f.id === config.fabricId) ?? FABRICS[0];
  const scene = SCENES.find((s) => s.id === config.sceneId) ?? SCENES[0];
  const crafts = CRAFTS.filter((c) => config.craftIds.includes(c.id));

  const colorSpecified = deconstructed.colorSpecifiedByUser;
  const colorReview = colorReviewText(deconstructed);
  const colorEn = colorSpecified
    ? (COLOR_EN[fabric.colorFamily] ?? 'refined neutral bespoke textile tone')
    : 'undecided fabric color (tonal placeholder for visual structure only)';
  const colorCn = colorSpecified
    ? fabric.colorName
    : '中性深调素雅示意色（仅作结构与肌理预览，最终成衣色待核）';

  const weaveEn = WEAVE_EN[fabric.weave] ?? 'fine luxury woven textile';
  const sheenEn = fabric.luster.includes('哑光') ? 'matte finish' :
    fabric.luster.includes('微光') ? 'soft low sheen' : 'directional visible sheen';
  const sceneEn = SCENE_EN[scene.id] ?? scene.name;
  const { silhouetteType, collarStyle, closureStyle } = pattern.blueprintConfig;
  const suitCollar = collarStyle === 'notch_lapel' ? 'notched lapels' :
    collarStyle === 'peak_lapel' ? 'peaked lapels' : 'a Mandarin stand collar';
  const suitFront = closureStyle === 'hidden_placket' ? 'a concealed front fastening' : 'a visible button front';
  const patternEn = silhouetteType === 'suit_ensemble'
    ? `${PATTERN_EN.suit_ensemble} with ${suitCollar} and ${suitFront}`
    : PATTERN_EN[silhouetteType] ?? pattern.name;
  const craftEnList =
    crafts.length > 0
      ? crafts.map((c) => CRAFT_EN_MAP[c.id] ?? 'refined bespoke hand-finished tailoring details').join(', ')
      : 'clean minimalist bespoke hand-finished seams';
  const craftCnList = crafts.length > 0 ? crafts.map((c) => c.name).join('、') : '极简高定净面精工';

  const isCrossCollarCase6 = pattern.blueprintConfig.silhouetteType === 'jacket_h_cross_collar';
  const isMensOfficial =
    isCrossCollarCase6 ||
    pattern.blueprintConfig.silhouetteType === 'jacket_h_low_collar' ||
    pattern.blueprintConfig.silhouetteType === 'jacket_h_dropped';

  const subjectEn =
    pattern.businessType === 'corporate_uniform'
      ? 'poised Chinese executive man and woman models wearing coordinated bespoke corporate ensemble'
      : isCrossCollarCase6
        ? 'tall poised dignified gentleman with broad shoulders wearing a relaxed effortless fit'
        : isMensOfficial
          ? 'poised dignified Chinese gentleman with a natural relaxed build'
          : 'poised elegant Chinese female model';
  const subjectCn =
    pattern.businessType === 'corporate_uniform'
      ? '气质挺拔的中国男女商务高管双人同框'
      : isCrossCollarCase6
        ? '身形偏高、肩背宽厚、气质从容大气的男士模特'
        : isMensOfficial
          ? '体态从容端庄的中国男士模特'
          : '仪态优雅的中国女士模特';

  const negEn = isCrossCollarCase6
    ? 'lowres, blurry, tight shoulders, tight sleeves, stand collar, mandarin collar, exposed buttons, frog buttons, flashy embroidery, plastic shiny polyester, wrinkled tension lines, watermark, text overlay'
    : 'lowres, blurry, tight fitting, wrinkled belly crease, high stiff collar, plastic shiny polyester, gaudy rhinestones, deformed hands, watermark, typography, text overlay';

  const mustPreserveConstraints: string[] = [
    `廓形与比例：${pattern.silhouette}；${pattern.lengthRatio}`,
    `领型与门襟：${pattern.collarType}${isCrossCollarCase6 ? '（严禁出现立领或外露纽扣）' : ''}`,
    `穿着体感与活动余量：${pattern.easeAllowance}`,
    ...deconstructed.bodyErgonomics.slice(0, 3),
  ];

  const colorDisclaimer = colorSpecified
    ? `客户已表达色彩倾向，提示词参考「${fabric.colorName}」；实物最终显色仍须以工坊高显色光源下米样核色为准。`
    : `${colorReview ?? '客户未指定颜色'}。提示词以中性色调预览廓形与质感，最终成衣色须按实物色卡确认。`;

  return {
    packTitle: `${input.projectName || pattern.name} · 视觉需求与绘图提示词包`,
    generatedAt: new Date().toISOString(),
    paletteSummary: colorSpecified
      ? `${fabric.colorName}（${fabric.pbr.baseColor}）× 光泽（${fabric.pbr.sheenColor}）｜${scene.lighting.colorTempLabel}`
      : `${colorReview ? '成衣颜色待核' : '色彩未指定'}（暂用中性示意色 ${fabric.pbr.baseColor}，待线下色卡核定）｜${scene.lighting.colorTempLabel}`,
    colorDisclaimer,
    mustPreserveConstraints,
    apiBoundaryNote:
      '【视觉工具边界】本模块仅输出标准化绘图提示词与视觉需求说明包（适配 Midjourney / Flux / 即梦），不对接外部生图 API，不做现场自动出图。',
    shots: [
      {
        shotType: 'full_garment',
        shotTitle: '镜头 01 · 成衣结构参考图（白棚正面/背面全貌）',
        shotSubtitle: '无干扰审视外轮廓、肩线落度、领襟结构、衣长比例与面料自然垂感',
        aspectRatio: '3:4',
        cameraSpec: '85mm 中长焦，f/4.0 成衣全貌清晰景深',
        lightingSpec: '5200K 画廊高显色柔光箱',
        prompts: {
          midjourney: `Clean editorial bespoke garment design sheet photograph showing front and back silhouette reference of ${patternEn}, crafted from ${colorEn} (${fabric.gsm}gsm ${weaveEn}), featuring ${craftEnList}. Minimalist soft alabaster studio backdrop, crisp balanced architectural drape with relaxed shoulder-armhole ease and zero clinging, 85mm lens f/4, CRI 95 gallery lighting, quiet-luxury tailoring archive style --ar 3:4 --v 6.1 --style raw --stylize 150`,
          flux_sd: `Minimalist luxury fashion design reference photograph of ${patternEn}, made of ${colorEn} (${fabric.gsm}gsm ${weaveEn}), refined details of ${craftEnList}, clean off-white gallery studio backdrop, balanced natural studio light showing authentic woven micro-texture and comfortable drape, ultra sharp 8k photorealistic`,
          jimeng_cn: `高定成衣设计效果图（正面与背面全貌参考），展示「${pattern.name}」（${pattern.silhouette}，${pattern.collarType}，${pattern.lengthRatio}，${pattern.easeAllowance}），面料采用${colorCn}${fabric.weave}（${fabric.drape}、${fabric.luster}），工艺呈现${craftCnList}。极简浅暖灰画廊白棚背景，高显色柔和棚拍光，清晰可见外轮廓、微落平肩与自然垂感，无紧绷拉扯褶皱，无文字水印。`,
        },
        negativePrompt: negEn,
      },
      {
        shotType: 'craft_macro',
        shotTitle: '镜头 02 · 领口、肩部与织物工艺细节图',
        shotSubtitle: '聚焦领襟走线、肩袖舒展结构、袖口下摆及小巧暗纹织花肌理',
        aspectRatio: '4:3',
        cameraSpec: '100mm 微距镜头，f/2.8 局部材质精拍',
        lightingSpec: '45° 侧向柔光勾勒织纹与精细车线',
        prompts: {
          midjourney: `Ultra-sharp 100mm macro bespoke tailoring detail collage focusing on collar edge, shoulder seam, cuff hem and woven micro-texture of a garment in ${colorEn} (${weaveEn}). Highlight ${craftEnList}. ${sheenEn}, visible clean hand-finished seam construction, soft directional atelier lighting, luxury textile archive photography --ar 4:3 --v 6.1 --style raw --stylize 140`,
          flux_sd: `100mm macro bespoke tailoring detail photography, close-up of collar, shoulder seam and sleeve cuff with ${craftEnList} on ${colorEn} (${fabric.gsm}gsm ${weaveEn}), crisp woven fibers, delicate hand-finished edges, soft directional side light, shallow depth of field, ultra realistic editorial quality`,
          jimeng_cn: `100mm 高清高定工艺细节微距特写，重点展示领口线条、肩部微落平肩接缝、袖口下摆结构与面料经纬肌理，材质为${colorCn}${fabric.weave}（${fabric.luster}），精细呈现${craftCnList}。45度柔和侧向工坊光凸显低调小巧暗纹与利落做工，4:3 构图，无文字水印。`,
        },
        negativePrompt: negEn,
      },
      {
        shotType: 'scene_editorial',
        shotTitle: `镜头 03 · 上身氛围场景参考图（${scene.shortName}）`,
        shotSubtitle: `预览成衣在「${scene.name}」光影下的上身气质、活动舒展度与场合契合感`,
        aspectRatio: '4:3',
        cameraSpec: '50mm 人文镜头，f/2.0 场景层次虚化',
        lightingSpec: `${scene.lighting.colorTempLabel}`,
        prompts: {
          midjourney: `Editorial quiet-luxury fashion photograph, 4:3 composition. ${subjectEn} standing poised and relaxed inside ${sceneEn}. Wearing ${patternEn} crafted from ${colorEn} (${weaveEn}), showcasing ${craftEnList}. Effortless natural posture with zero shoulder compression or arm tension. Authentic ${scene.lighting.colorTempLabel} lighting, 50mm f/2.0, refined Asian modern luxury magazine aesthetic --ar 4:3 --v 6.1 --style raw --stylize 180`,
          flux_sd: `Cinematic editorial fashion photograph, ${subjectEn} inside ${sceneEn}, wearing bespoke ${patternEn} in ${colorEn} (${weaveEn}) featuring ${craftEnList}, relaxed natural movement without tight pull lines, authentic ${scene.lighting.colorTempLabel} lighting, realistic fabric drape and proportions, 8k magazine photography`,
          jimeng_cn: `杂志级上身氛围穿搭参考图，4:3 横构图。${subjectCn}置身于「${scene.name}」（${scene.atmosphereKeywords.join('、')}），身着「${pattern.name}」（${pattern.collarType}，${pattern.easeAllowance}），面料为${colorCn}${fabric.weave}，呈现${craftCnList}。自然站立与抬臂舒展无紧绷感，环境光为${scene.lighting.colorTempLabel}，真实质感与克制高级气度，无文字水印。`,
        },
        negativePrompt: negEn,
      },
    ],
    deliveryBrief: [
      colorDisclaimer,
      '建议先用「镜头 01 成衣结构图」与「镜头 02 细节图」核对领型、肩线、暗纹密度与无扣设计，再以「镜头 03 上身氛围图」确认正式场合气场。',
      `视觉需求包仅作前期审美沟通，实物面料须以静态库对应编号 ${fabric.code}（${fabric.shortName}）及线下工坊米样实测为准。`,
    ],
  };
}
