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
   * 录屏上传至 B 站 / 腾讯视频 / YouTube（公开无密码直链）后，
   * 只需填写 externalUrl / embedUrl（或将视频文件放到 public/video/ 后填写 localMp4Path），
   * 推送至 GitHub main 分支，Cloudflare Workers Builds 将自动构建并同步上线至 sartoria.zichengyu.com/video。
   */
  video: {
    title: 'Sartoria AI · 3 分钟端到端海派定制企划闭环演示',
    subtitle: '主 Demo：官方案例六（交领开襟真丝暗纹外套）＋ 对比案例三（户外舞台两件式演出套装）',
    externalUrl: '',
    embedUrl: '',
    localMp4Path: '',
    durationLabel: '约 3 分钟',
    hostingChecklist: [
      '公开可访问直链（推荐 B 站 / 腾讯视频 / YouTube），不设访问密码',
      '上传完成后先用浏览器未登录无痕窗口试播，确认音画与链接均正常',
      '仅使用可公开的模拟静态定制素材，不展示真实客户隐私或生产系统信息',
    ],
  },
} as const;
