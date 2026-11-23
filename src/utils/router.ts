import type { WorkspaceTab } from '../components/TopNav';

export type PortalSection = 'home' | 'demo' | 'video' | 'docs';

export interface AppRoute {
  section: PortalSection;
  demoTab: WorkspaceTab;
}

const DEMO_TABS: WorkspaceTab[] = [
  'requirements',
  'configurator',
  'proposal',
  'knowledge',
  'ledger',
];

export function parsePathname(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const lower = clean.toLowerCase();

  if (lower === '/' || lower === '/home' || lower === '/overview') {
    return { section: 'home', demoTab: 'requirements' };
  }

  if (lower === '/video' || lower === '/vedio') {
    return { section: 'video', demoTab: 'requirements' };
  }

  if (lower === '/docs' || lower === '/doc' || lower.startsWith('/docs/')) {
    return { section: 'docs', demoTab: 'requirements' };
  }

  if (lower === '/demo') {
    return { section: 'demo', demoTab: 'requirements' };
  }

  if (lower.startsWith('/demo/')) {
    const seg = lower.slice('/demo/'.length).split('/')[0] as WorkspaceTab;
    if (DEMO_TABS.includes(seg)) {
      return { section: 'demo', demoTab: seg };
    }
    return { section: 'demo', demoTab: 'requirements' };
  }

  return { section: 'home', demoTab: 'requirements' };
}

export function buildPathname(route: AppRoute): string {
  if (route.section === 'home') return '/';
  if (route.section === 'video') return '/video';
  if (route.section === 'docs') return '/docs';
  if (route.demoTab === 'requirements') return '/demo';
  return `/demo/${route.demoTab}`;
}
