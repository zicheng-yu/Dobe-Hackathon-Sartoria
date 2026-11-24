import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dist = resolve(workspace, 'dist');
const output = resolve(process.env.SARTORIA_BROWSER_OUTPUT ?? resolve(workspace, 'node_modules/.cache/sartoria-browser/results'));
const playwrightModule = process.env.SARTORIA_PLAYWRIGHT_MODULE;
const { chromium } = await import(playwrightModule ? pathToFileURL(resolve(playwrightModule)).href : 'playwright');
const local = 'http://localhost:4175';
const publicDemo = 'https://sartoria.zichengyu.com/demo';
const mainBrief = '60 套，室内正式，藏青，耐皱，可机洗，不像传统制服。';
const firstFeedback = '想要更亮，最好真丝；机洗和藏青不动';
const secondFeedback = '光泽改成哑光；机洗和藏青不动';
const projectName = '浏览器回归同名项目';
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'application/javascript'], ['.css', 'text/css'],
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'], ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'], ['.woff2', 'font/woff2'], ['.json', 'application/json'],
]);

const browser = await chromium.launch({
  executablePath: process.env.SARTORIA_CHROMIUM_PATH,
  args: ['--disable-crash-reporter', '--disable-crashpad-for-testing'],
});
const context = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' });
const page = await context.newPage();
page.setDefaultTimeout(7000);

function visible(locator) {
  return locator.waitFor({ state: 'visible' });
}

function click(scope, name) {
  return scope.getByRole('button', { name, exact: typeof name === 'string' }).click();
}

function region(name) {
  return page.getByRole('region', { name });
}

function openFlowStep(name) {
  return page.locator('.stepper-node').filter({ hasText: name }).click();
}

async function assertText(locator, text) {
  await visible(locator.getByText(text, { exact: typeof text === 'string' }).first());
}

async function waitForTitle(title) {
  await visible(page.getByRole('heading', { level: 1, name: title }));
}

async function analyze() {
  await click(page, '拆解需求');
  await assertText(region('需求约束'), '本地规则 · 人工确认');
}

async function chooseProjectBusiness(name = projectName) {
  await page.getByText('补充项目与场景信息', { exact: true }).click();
  await page.getByLabel('项目名称', { exact: true }).fill(name);
  await page.getByLabel('业务类型', { exact: true }).selectOption('corporate_uniform');
  await page.getByLabel('主穿季候', { exact: true }).selectOption('autumn');
  await page.getByLabel('穿搭场景', { exact: true }).selectOption('scene-lujiazui-summit');
}

async function download(scope, label, filename) {
  const [artifact] = await Promise.all([page.waitForEvent('download'), click(scope, label)]);
  const file = resolve(output, filename);
  await artifact.saveAs(file);
  const data = await readFile(file, 'utf8');
  assert.doesNotMatch(data, /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/, 'export contains an API key pattern');
  return data;
}

async function verifyPublic() {
  const response = await page.goto(publicDemo, { waitUntil: 'domcontentloaded', timeout: 20000 });
  assert.equal(response?.status(), 200);
  await waitForTitle('需求拆解');
  await visible(page.locator('#req-narrative'));
  console.log(JSON.stringify({
    url: page.url(), status: response.status(), heading: '需求拆解',
    localBranchControlPresent: await page.getByRole('button', { name: '新建简报' }).count() > 0,
  }));
}

async function routeLocalBuild(browserContext, external, serveHttp, mockDeconstruct) {
  const index = serveHttp ? null : await readFile(resolve(dist, 'index.html'));
  await browserContext.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== local) {
      external.push(url.origin);
      return route.abort();
    }
    if (url.pathname === '/api/deconstruct' && mockDeconstruct) return mockDeconstruct(route);
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { ok: false } });
    if (serveHttp) return route.continue();
    if (!extname(url.pathname)) return route.fulfill({ body: index, contentType: mime.get('.html') });
    const file = resolve(dist, `.${decodeURIComponent(url.pathname)}`);
    const fromDist = relative(dist, file);
    if (fromDist.startsWith('..') || isAbsolute(fromDist)) return route.abort();
    try {
      return route.fulfill({ body: await readFile(file), contentType: mime.get(extname(file)) ?? 'application/octet-stream' });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return route.fulfill({ status: 404, body: 'Asset missing' });
    }
  });
}

async function verifyLocal() {
  const external = [];
  const errors = [];
  await routeLocalBuild(context, external, process.argv.includes('--http'));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${local}/demo`, { waitUntil: 'domcontentloaded' });
  await waitForTitle('需求拆解');
  if (!process.argv.includes('--http')) {
    await context.setOffline(true);
    assert.equal(await page.evaluate(() => navigator.onLine), false);
  }

  await click(page, '新建简报');
  const narrative = page.getByLabel('客户原话');
  assert.equal(await narrative.inputValue(), '');
  await chooseProjectBusiness();
  await narrative.fill(mainBrief);
  await analyze();
  const hard = region('必须满足');
  await assertText(hard, '60 套');
  await assertText(hard, '可机洗');
  await assertText(hard, '排除 · 传统制服');
  await hard.getByText('查看原话', { exact: true }).first().click();
  await assertText(hard, '「60 套」');
  await click(page, '下一步：进入场景选配');
  const comparison = region('方案对比');
  await assertText(comparison, 'A · 主推');
  await assertText(comparison, 'B · 替代');
  await assertText(comparison, '拒绝示例');
  const matte = comparison.getByRole('article').filter({ has: page.getByRole('heading', { name: '藏青哑光斜纹' }) });
  const lustered = comparison.getByRole('article').filter({ has: page.getByRole('heading', { name: '藏青亮缎混纺' }) });
  await click(lustered, '选用此方案');
  await assertText(lustered, '已选用');
  await click(matte, '选用此方案');
  await assertText(matte, '已选用');

  const revision = region('客户改稿');
  await click(revision, '保存初版');
  const feedback = page.getByLabel('客户反馈原话');
  await visible(feedback);
  await feedback.fill(firstFeedback);
  await click(revision, '预览改稿差异');
  const preview = page.locator('[aria-label="改稿差异预览"]');
  await assertText(preview, '待裁决的冲突');
  await assertText(preview, /目前无组合同时满足材质偏好/);
  await click(revision, '取消预览并保留草稿');
  assert.equal(await feedback.inputValue(), firstFeedback);
  await click(revision, '预览改稿差异');
  await click(preview, '按原硬条件确认');
  await assertText(revision, '当前版本 V2');

  await feedback.fill(secondFeedback);
  await click(revision, '预览改稿差异');
  await click(preview, '按原硬条件确认');
  await assertText(revision, '当前版本 V3');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assertText(revision, '当前版本 V3');
  await openFlowStep('项目档案');
  await waitForTitle('项目档案');
  const handoff = region('版本交接');
  const historic = handoff.getByLabel('查看版本');
  await historic.selectOption({ label: 'V1' });
  const initial = JSON.parse(await download(handoff, '下载 JSON', 'conference-V1.json'));
  await historic.selectOption({ label: 'V2' });
  const revised = JSON.parse(await download(handoff, '下载 JSON', 'conference-V2.json'));
  const markdown = await download(handoff, '下载交接文档', 'conference-V2.md');
  assert.equal(initial.version.number, 1);
  assert.equal(revised.version.number, 2);
  assert.equal(revised.previousVersionId, initial.version.id);
  assert.equal(revised.version.requirement.turns[1].text, firstFeedback);
  assert.deepEqual(revised.versionChanges.map(({ field }) => field).sort(), ['fabric', 'luster']);
  const hardConstraints = (record) => record.version.requirement.constraints.filter(({ level }) => level === 'hard');
  assert.deepEqual(hardConstraints(initial), hardConstraints(revised));
  assert.equal(initial.version.candidate.config.fabricId, 'fab-demo-navy-washable-twill');
  assert.equal(revised.version.candidate.config.fabricId, 'fab-demo-navy-lustrous-blend');
  assert.equal(revised.version.candidate.config.patternId, initial.version.candidate.config.patternId);
  assert.equal(revised.version.candidate.config.sceneId, initial.version.candidate.config.sceneId);
  assert.match(markdown, /想要更亮，最好真丝/);
  assert.match(markdown, /模拟/);
  await click(page, '回选配室修改');
  await assertText(revision, '当前版本 V3');
  const conference = { offline: !process.argv.includes('--http'), versions: [1, 2, 3], initialFabric: initial.version.candidate.config.fabricId, revisedFabric: revised.version.candidate.config.fabricId };

  await page.goto(`${local}/demo`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /示例简报/ }).click();
  await page.getByRole('option', { name: /正式外套 · 交领真丝暗纹/ }).click();
  await analyze();
  const constraints = region('需求约束');
  await assertText(constraints, '肩臂活动余量');
  const color = constraints.getByRole('article').filter({ hasText: '色系' });
  await assertText(color, '待确认');
  const silk = constraints.getByRole('article').filter({ hasText: '真丝' });
  await assertText(silk, /系统建议/);
  await click(page, '下一步：进入场景选配');
  await assertText(comparison, /交领/);
  await click(revision, '保存初版');
  await openFlowStep('项目档案');
  await waitForTitle('项目档案');
  const case6 = JSON.parse(await download(handoff, '下载 JSON', 'official-case-6-V1.json'));
  assert.notEqual(case6.version.projectId, revised.version.projectId);
  assert.equal(case6.version.requirement.input.presetDemoId, 'official-case-6');
  assert.equal(case6.version.requirement.constraints.find(({ field }) => field === 'color').value, null);
  assert.equal(case6.version.candidate.config.patternId, 'pat-official-cross-collar-silk');
  await click(page, '回选配室修改');
  await assertText(revision, '当前版本 V1');

  await page.goto(`${local}/demo`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /示例简报/ }).click();
  await page.getByRole('option', { name: /演出套装 · 户外舞台两件套/ }).click();
  await analyze();
  await assertText(constraints, '两件式');
  await assertText(constraints, '肩臂活动余量');
  await click(page, '下一步：进入场景选配');
  await assertText(comparison, /两件式/);
  await click(revision, '保存初版');
  await openFlowStep('项目档案');
  const case3 = JSON.parse(await download(handoff, '下载 JSON', 'official-case-3-V1.json'));
  assert.equal(case3.version.requirement.input.presetDemoId, 'official-case-3');
  assert.equal(case3.version.requirement.constraints.find(({ field }) => field === 'patternStructure').value, 'two_piece');

  // Reuse the project name deliberately and verify the saved IDs and histories are independent.
  await click(page, '新建需求');
  await chooseProjectBusiness();
  await narrative.fill(mainBrief.replace('60 套', '72 套'));
  await analyze();
  await click(region('必须满足'), '编辑洗护');
  const editor = page.getByRole('form', { name: '编辑洗护' });
  await editor.getByLabel('洗护', { exact: true }).selectOption('dry_clean');
  await click(editor, '确认并保存');
  await assertText(region('必须满足').getByRole('article').filter({ hasText: '洗护' }), '人工确认');
  await click(page, '下一步：进入场景选配');
  await visible(comparison);
  assert.equal(await matte.count(), 0, 'changing only the confirmed care requirement should remove the washable candidate');
  await openFlowStep('需求拆解');
  await click(region('必须满足'), '编辑洗护');
  await editor.getByLabel('洗护', { exact: true }).selectOption('machine_wash');
  await click(editor, '确认并保存');
  await click(page, '下一步：进入场景选配');
  await click(revision, '保存初版');
  await openFlowStep('项目档案');
  const second = JSON.parse(await download(handoff, '下载 JSON', 'same-name-V1.json'));
  assert.equal(second.version.requirement.input.projectName, initial.version.requirement.input.projectName);
  assert.notEqual(second.version.projectId, initial.version.projectId);
  assert.equal(second.version.number, 1);
  assert.equal(second.version.requirement.constraints.find(({ field }) => field === 'care').state, 'confirmed');
  const projectRows = page.getByRole('row').filter({ hasText: projectName });
  assert.equal(await projectRows.count(), 2);
  let foundOriginal = false;
  for (const row of await projectRows.all()) {
    await row.click();
    const labels = await historic.getByRole('option').allTextContents();
    if (labels.some((label) => label.startsWith('V3'))) {
      await historic.selectOption({ label: 'V2' });
      const reopened = JSON.parse(await download(handoff, '下载 JSON', 'conference-V2-reopened.json'));
      assert.deepEqual(reopened, revised);
      foundOriginal = true;
      break;
    }
  }
  assert.equal(foundOriginal, true);
  const pending = await verifyPendingVersions();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ conference, case6: case6.version.candidate.config.patternId, case3: case3.version.candidate.config.patternId, sameNameProjects: 2, pending, blockedOrigins: [...new Set(external)] }));
}

function assertPendingSnapshot(snapshot, number) {
  const { version } = snapshot;
  assert.equal(version.number, number);
  assert.equal(version.match.status, 'no_match');
  assert.equal(version.match.recommended, null);
  assert.equal(version.match.alternative, null);
  assert.equal(version.candidate, null);
  assert.equal(version.proposal, null);
  assert.equal(version.promptPack, null);
  assert.ok(snapshot.reviews.some(({ field }) => field === 'candidate'));
  assert.ok(version.match.rejected.length > 0 || version.match.review.length > 0);
}

async function verifyPendingVersions() {
  const name = '浏览器回归待核项目';
  const impossible = '团体职业服共 29 套，室内正式，必须真丝，必须可机洗，必须低光泽。';
  const change = '数量改成 31 套，其余照旧。';
  const comparison = region('方案对比');
  const revision = region('客户改稿');
  const handoff = region('版本交接');

  await click(page, '新建需求');
  await chooseProjectBusiness(name);
  await page.getByLabel('客户原话').fill(impossible);
  await analyze();
  await click(page, '下一步：进入场景选配');
  await assertText(comparison, /暂无满足全部硬条件的组合/);
  assert.equal(await comparison.getByRole('button', { name: '选用此方案' }).count(), 0);
  await click(revision, '保存待核初版');
  await assertText(revision, '当前版本 V1 · 待核');
  await openFlowStep('项目档案');
  const firstJson = await download(handoff, '下载 JSON', 'pending-V1.json');
  const first = JSON.parse(firstJson);
  assertPendingSnapshot(first, 1);
  assert.equal(first.version.revision, null);
  assert.equal(first.version.requirement.turns[0].text, impossible);

  await click(page, '回选配室修改');
  await page.getByLabel('客户反馈原话').fill(change);
  await click(revision, '预览改稿差异');
  const preview = page.locator('[aria-label="改稿差异预览"]');
  const accept = preview.getByRole('article').filter({ has: page.getByRole('heading', { name: '确认更改要求', exact: true }) });
  await assertText(accept, '暂无合格组合');
  await click(accept, '确认条件并保存待核版');
  await assertText(revision, '当前版本 V2 · 待核');
  await assertText(comparison, /暂无满足全部硬条件的组合/);

  await openFlowStep('项目档案');
  const secondJson = await download(handoff, '下载 JSON', 'pending-V2.json');
  const second = JSON.parse(secondJson);
  assertPendingSnapshot(second, 2);
  assert.equal(second.previousVersionId, first.version.id);
  assert.equal(second.version.projectId, first.version.projectId);
  assert.equal(second.version.revision.selectedOption, 'accept');
  assert.equal(second.version.revision.humanDecision, 'confirmed');
  assert.equal(second.version.revision.turn.text, change);
  assert.deepEqual(second.versionChanges.map(({ field }) => field), ['quantity']);
  assert.equal(second.versionChanges[0].previous.value, 29);
  assert.equal(second.versionChanges[0].next.value, 31);
  const ledger = JSON.parse(await download(page, '导出 JSON', 'pending-ledger.json'));
  const record = ledger.find(({ id }) => id === second.version.projectId);
  assert.ok(record);
  assert.equal(record.config, null);
  assert.equal(record.proposal, null);
  assert.equal(record.promptPack, null);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('row').filter({ hasText: name }).click();
  await click(page, '回选配室修改');
  await assertText(revision, '当前版本 V2 · 待核');
  await openFlowStep('项目档案');
  const versionPicker = handoff.getByLabel('查看版本');
  await versionPicker.selectOption({ label: 'V1' });
  assert.equal(await download(handoff, '下载 JSON', 'pending-V1-reopened.json'), firstJson);
  await versionPicker.selectOption({ label: 'V2 · 最新' });
  assert.equal(await download(handoff, '下载 JSON', 'pending-V2-reopened.json'), secondJson);
  return { versions: [1, 2], status: second.version.match.status, exactJsonAfterReopen: true };
}

async function verifyMockFallback() {
  const mockedResponses = [
    { name: 'invalid-JSON', status: 200, contentType: 'application/json', body: '{"ok":', notice: /在线 AI 代理服务暂不可用/ },
    { name: 'upstream-504', status: 504, json: { ok: false, errorCode: 'TIMEOUT', message: '模拟上游超时' }, notice: '模拟上游超时' },
  ];
  for (const { name, notice, ...response } of mockedResponses) {
    const isolated = await browser.newContext({ serviceWorkers: 'block' });
    let posts = 0;
    await routeLocalBuild(isolated, [], false, (route) => {
      const request = route.request();
      assert.equal(request.method(), 'POST');
      assert.equal(request.postDataJSON().rawNarrative, mainBrief);
      assert.doesNotMatch(request.postData(), /fixture-only-obsolete-key/);
      posts += 1;
      return route.fulfill(response);
    });
    await isolated.addInitScript(() => {
      localStorage.setItem('sartoria_ai_engine_mode_v2', 'online_worker');
      localStorage.setItem('sartoria_ai_llm_settings_v1', JSON.stringify({ apiKey: 'fixture-only-obsolete-key' }));
    });
    const faultPage = await isolated.newPage();
    try {
      await faultPage.goto(`${local}/demo`, { waitUntil: 'domcontentloaded' });
      await click(faultPage, '新建简报');
      await faultPage.getByLabel('客户原话').fill(mainBrief);
      await click(faultPage, '拆解需求');
      await assertText(faultPage, notice);
      assert.equal(await faultPage.getByRole('region', { name: '需求约束' }).count(), 0);
      assert.equal(await faultPage.evaluate(() => localStorage.getItem('sartoria_ai_llm_settings_v1')), null);
      await click(faultPage, '使用本地规则引擎拆解');
      await assertText(faultPage.getByRole('region', { name: '需求约束' }), '本地规则 · 人工确认');
      await click(faultPage, '下一步：进入场景选配');
      const comparison = faultPage.getByRole('region', { name: '方案对比' });
      await assertText(comparison, 'A · 主推');
      await assertText(comparison, 'B · 替代');
      assert.equal(posts, 1);
      console.log(JSON.stringify({ mock: name, interceptedRequests: posts, fallback: 'local_rules', matchedCandidates: 2 }));
    } catch (error) {
      await faultPage.screenshot({ path: resolve(output, `fault-${name}.png`), fullPage: true }).catch(() => {});
      throw error;
    } finally {
      await isolated.close();
    }
  }
}

await mkdir(output, { recursive: true });
try {
  if (process.argv.includes('--public')) await verifyPublic();
  else if (process.argv.includes('--faults')) await verifyMockFallback();
  else await verifyLocal();
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  console.error((await page.locator('main').innerText().catch(() => '')).slice(0, 4500));
  throw error;
} finally {
  await browser.close();
}
