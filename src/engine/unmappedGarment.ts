import type { ConstraintField } from '../types/decisions';

// Use the role of an unfamiliar garment term to request clarification. Never infer a catalog value from it.
const selectedCollar = /(?:采用|选用|裁成|制成|做成|用|选)(?![^，。；;\s]{0,6}(?:人|自|来|去|代|认)领)([\p{Script=Han}]{1,6}领)(?=$|\s|款|造型|上衣|外套|连衣裙)/u;
const namedCollar = /(?:圆|方|船|娃娃|一字|荷叶|鸡心|[vVＶ])(?:形|型|字)?领/u;
const separateBottom = /(?:半裙|半身裙|西裤|长裤|短裤)/u;
const kneeLength = /(?:裙长|裙摆|衣长|下摆)(?:必须|需要|只要|想要|得|要|做到|到|在|刚好|刚刚)*(?:过膝|及膝|膝上|膝下)|(?:过膝|及膝)裙/u;
const ordered = /(?:想要|想做|需要|打算做|选用|采用|指定|[定订]做?|来一|做一|这次做)/u;

export function unmappedGarmentTerm(field: ConstraintField, clause: string): RegExpExecArray | null {
  if (field === 'collar') return selectedCollar.exec(clause) ?? namedCollar.exec(clause);
  if (field === 'lengthRatio') return kneeLength.exec(clause);
  if (field === 'category' && ordered.test(clause) && !/(?:搭配|配上|配套|和|跟|以及|参考)/u.test(clause)) {
    return separateBottom.exec(clause);
  }
  return null;
}
