// Location adjectives by themselves do not identify an event: a customer can collect a coat indoors.
// Treat them as venues only when they describe a performance or continue its location predicate.
const subject = '(?:舞台(?:演出)?|演出|演奏会|音乐会|话剧|舞台剧|演奏|表演|演唱会)(?:的?(?:场地|地点|场所|位置))?';
const link = '(?:(?:也|还|又|说|规定|要求|肯定|一定|绝对|必须|务必|只能|需要|不能|不要|不许|不得|禁止|不准|不允许|不是|不会|不|要|得|是|安排|设置|设|搭|定|放|在|到|选|于)\\s*){0,8}';
const stagePredicate = new RegExp(subject + '\\s*' + link + '$', 'u');
const continuedPredicate = new RegExp('^\\s*(?:(?:场地|地点|演出场所|舞台位置)\\s*)?' + link + '$', 'u');
const stageSubjectOnly = new RegExp('(?:^|(?:这次|这场|这个|本次|本场|说到|至于)|(?:用于|用来|参加).{0,8})' + subject + '$', 'u');

export function stageLocations(text: string, inheritsSubject = false) {
  const locations: { value: string; start: number; end: number }[] = [];
  for (const match of text.matchAll(/(?:室内|室外|户外|露天)(?:礼堂|剧场|广场|庭院)?|(?:学校|校内|校)?礼堂/gu)) {
    const end = match.index + match[0].length;
    const tail = text.slice(end);
    if (!/^(?:的)?(?:$|\s|或|还是|也|举行|举办|进行|演出|上演|公演|搭台|演$|穿$)/u.test(tail)) continue;
    const prefix = text.slice(0, match.index);
    const last = locations.at(-1);
    const alternative = last && /^(?:的)?\s*(?:或(?:者)?|还是)\s*$/u.test(text.slice(last.end, match.index));
    if (!stagePredicate.test(prefix) && !(inheritsSubject && continuedPredicate.test(prefix)) && !alternative) continue;
    const indoors = /^(?:室内|(?:学校|校内|校)?礼堂)/u.test(match[0]);
    locations.push({ value: indoors ? 'indoor_performance' : 'outdoor_stage', start: match.index, end });
  }
  return locations;
}

export function namesStageSubject(text: string): boolean {
  return stageSubjectOnly.test(text) || stageLocations(text).length > 0;
}

export function excludesVenue(prefix: string): boolean {
  return /(?:不能|禁止|不得|不许|不准|不允许|别)(?:再)?(?:安排|设置|设|搭|定|放|选)?(?:在|于|到)\s*$/u.test(prefix);
}
