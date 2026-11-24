export const SITE_CONFIG = {
  brand: 'Sartoria AI',
  siteUrl: 'https://sartoria.zichengyu.com',
  githubUrl: 'https://github.com/zicheng-yu/Dobe-Hackathon-Sartoria',
  trackLabel: 'FDE 赛道 · 上海服装集团 · 海派定制 AI 企划辅助命题',
  routes: {
    home: '/',
    demo: '/demo',
    video: '/video',
    docs: '/docs',
  },
  /**
   * 3 分钟 Demo 视频配置：
   * 成片静态托管于 public/video/，推送至 GitHub main 分支后由 Cloudflare Workers Builds
   * 自动构建并发布至 https://sartoria.zichengyu.com/video 公开无密码直连播放。
   */
  video: {
    title: 'Sartoria AI · 3 分钟端到端海派定制企划闭环演示',
    subtitle: '双案例全流程真实操作：60 套秋季会务团装（冲突裁决）＋ 官方案例六高定外套（未指定不代定色 · 三镜头提示词）',
    externalUrl: '',
    embedUrl: '',
    localMp4Path: '/video/sartoria-demo-3min.mp4',
    posterPath: '/video/poster.jpg',
    durationLabel: '2:51',
    hostingChecklist: [
      '由 Cloudflare Workers 直接托管于 sartoria.zichengyu.com/video，支持公开无密码直连与流式播放',
      '已通过浏览器未登录无痕窗口验证音画同步、章节跳转与 1080P 播放正常',
      '仅使用可公开的模拟静态定制素材，不展示真实客户隐私或生产系统信息',
    ],
  },
} as const;
