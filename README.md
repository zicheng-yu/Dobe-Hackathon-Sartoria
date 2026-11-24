# Sartoria AI — 海派高定与团体职业服 AI 企划辅助系统

> 面向高级定制企划人员、定制业务专员与团体职业服方案设计师的前置 AI 企划决策工作台。  
> 将客户感性自然语言需求转化为可溯源的定制约束、可验证的资产组合方案、三镜头视觉需求包与版本化交接档案。
>
> - **在线官网**：https://sartoria.zichengyu.com
> - **在线工作台**：https://sartoria.zichengyu.com/demo
> - **演示视频**：https://sartoria.zichengyu.com/video（兼容 `/vedio`）
> - **系统架构文档**：https://sartoria.zichengyu.com/docs
> - **GitHub 仓库**：https://github.com/zicheng-yu/Dobe-Hackathon-Sartoria

![Sartoria AI 首页总览与四步企划工作流](./public/assets/docs/sartoria-home.png)

---

## 核心能力闭环

1. **双引擎需求拆解与三类信息隔离（`/demo`）**  
   支持云端严格 Schema 智能解析（Cloudflare Worker + OpenAI Responses API）与零 Key 本地确定性规则引擎无缝协同，将自然语言口述转化为 **8 项专业定制参数** + **6 维审美雷达**，严格分离「**用户明确 / 系统建议 / 人工核实**」并保留逐字原话引文——未指定颜色绝不代客定色，松弛余量不虚构厘米数值。
2. **硬筛方案对比、多轮改稿与混合可视化选配（`/demo/configurator`、`/demo/knowledge`）**  
   基于 36 条在用静态模拟定制资产（9 款版型、13 款在用面料、11 项工艺、3 个参考案例，可扩展 `stylePackId` 企业风格包）执行硬约束筛选与 A/B 组合对比，透明披露逐项证据、拒绝与待核依据；支持多轮自然语言客户改稿预览、分支裁决与不可变版本号递进（`V1 → V2`），配合 6 大实景场景切换、工艺热点缩放、Three.js PBR 3D 面料光泽参考与 SVG 结构蓝图。
3. **带依据定制方案初稿与三镜头视觉需求包（`/demo/proposal`）**  
   一键生成含四类资产匹配依据、面料三维判断依据（风格适配 / 体感适配 / 体型适配）、五维可行性护栏与六步人机分工的《定制方案初稿》（支持导出 Markdown 与排版打印），同步编译成衣 / 细节 / 上身氛围三镜头提示词包（即梦中文 / Midjourney / Flux，不调用外部绘图 API）。
4. **版本化项目档案与标准化交接（`/demo/ledger`）**  
   沉淀原始需求、版本快照、人工复核状态/备注与显式前后变更 `diffSummary`，支持按任意已选版本导出 `sartoria_handoff_v1` JSON、UTF-8 BOM CSV、Markdown 交接文档及一键回载至选配工作台。
5. **完整系统架构与人机能力边界说明**  
   详见 [docs/Sartoria-AI-Solution-Architecture.md](./docs/Sartoria-AI-Solution-Architecture.md)（已在线同步渲染于 `/docs`，支持 Mermaid 架构图与实机图文浏览）与跨模块数据合同 [docs/decision-contract.md](./docs/decision-contract.md)。

---

## 技术栈与边缘架构

- **前端应用**：TypeScript · React 19 · Vite 8 · Three.js · Framer Motion · Mermaid（文档页按需懒加载）
- **边缘服务与配额治理**：Cloudflare Workers（`/api/llm/status`、`/api/deconstruct`）· Cloudflare Durable Objects SQLite（`QuotaBudgetLedger` 原子日限流与项目累计预算硬顶）· Workers Static Assets SPA 托管
- **工程质量保障**：22 个测试文件、282 项 Vitest 自动化测试（含多批次盲测回归、色彩作用域、云端响应离线回放与 Worker 配额安全单测）+ 离线 Chromium 端到端回归套件（`evaluation/browser/`）

---

## 本地开发与验证

环境要求：Node.js `>= 22`

```bash
# 1. 安装依赖
npm install

# 2. 启动前端本地开发服务器（离线可用本地规则引擎）
npm run dev

# 3. 如需联调本地 Cloudflare Worker 与 Durable Objects
npm run dev:worker

# 4. 运行自动化测试与回归验证
npm test
npm run test:release

# 5. 代码检查、类型检查与生产构建
npm run lint
npm run build
```

---

## 部署与自动构建

- 配置文件：[wrangler.jsonc](./wrangler.jsonc)（`assets.run_worker_first: ["/api/*"]` + `not_found_handling: "single-page-application"` + Durable Objects `QuotaBudgetLedger`）。
- 构建与发布：`npm run build` → `npx wrangler deploy`（或通过已绑定的 Cloudflare Workers Builds 监听 `main` 分支，推送后自动构建并同步上线至 `https://sartoria.zichengyu.com`）。
- 如需更新演示视频直链，编辑 [src/data/siteConfig.ts](./src/data/siteConfig.ts) 中的 `video.externalUrl` / `video.embedUrl` 后推送 `main` 即可自动生效。
