import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { SCENES } from '../data/scenes';
import type { ConfigurationState, CraftHotspot } from '../types/sartoria';

export interface ResolvedStageVisual {
  heroImage: string;
  craftCloseupImage: string;
  isExactPhotographicVariant: boolean;
  previewBadge: string;
  ambientFilter: string;
  fabricTintOverlay: string;
  hotspots: Array<{
    id: string;
    title: string;
    subtitle: string;
    badge: string;
    hotspot: CraftHotspot;
    closeupImage: string;
  }>;
}

export function resolveStageVisual(config: ConfigurationState): ResolvedStageVisual {
  const pattern = PATTERNS.find((p) => p.id === config.patternId) ?? PATTERNS[0];
  const fabric = FABRICS.find((f) => f.id === config.fabricId) ?? FABRICS[0];
  const scene = SCENES.find((s) => s.id === config.sceneId) ?? SCENES[0];
  const crafts = CRAFTS.filter((c) => config.craftIds.includes(c.id));

  const silhouette = pattern.blueprintConfig.silhouetteType;
  const isUniform = pattern.businessType === 'corporate_uniform';
  const isOfficialMensJacket =
    silhouette === 'jacket_h_cross_collar' ||
    silhouette === 'jacket_h_low_collar' ||
    silhouette === 'jacket_h_dropped';
  const isOfficialShawl = silhouette === 'jacket_h_shawl';
  const isStageTwoPiece = silhouette === 'stage_two_piece';

  let heroImage = scene.fallbackImage;
  let isExact = false;
  let previewBadge = `${scene.shortName} · ${fabric.shortName}`;

  if (isOfficialMensJacket) {
    if (scene.id === 'scene-bund-protocol') {
      heroImage = '/assets/case2-protocol-navy.jpg';
      isExact = false;
      previewBadge = `正式礼厅氛围 · ${fabric.colorName}`;
    } else if (scene.id === 'scene-lujiazui-summit') {
      heroImage =
        fabric.colorFamily === 'stone_gray'
          ? '/assets/case2-lujiazui-stonegray.jpg'
          : fabric.colorFamily === 'pine_green'
            ? '/assets/case2-lujiazui-pinegreen.jpg'
            : '/assets/case2-lujiazui-navy.jpg';
      isExact = false;
      previewBadge = `金融峰会场景 · ${fabric.shortName}`;
    } else {
      heroImage = '/assets/official1-studio-jacket.jpg';
      isExact =
        fabric.id === 'fab-official-silk-jacquard-subtle' ||
        fabric.id === 'fab-official-acetate-jacquard' ||
        fabric.id === 'fab-official-xiangyun-matte';
      previewBadge = `${scene.shortName} · ${fabric.shortName}`;
    }
  } else if (isStageTwoPiece) {
    if (scene.id === 'scene-bund-banquet') {
      heroImage = '/assets/case1-bund-moonlight-white.jpg';
      isExact = false;
      previewBadge = `晚宴氛围 · ${fabric.shortName}`;
    } else {
      heroImage = '/assets/courtyard-garden-soiree.jpg';
      isExact = fabric.id === 'fab-official-ivory-rose-stage';
      previewBadge = `户外舞台氛围 · ${fabric.shortName}`;
    }
  } else if (isOfficialShawl) {
    if (fabric.id === 'fab-suzhou-moonlight-white') {
      heroImage = '/assets/case1-bund-moonlight-white.jpg';
      isExact = true;
    } else if (fabric.id === 'fab-xiangyun-crimson-velvet') {
      heroImage = '/assets/case1-bund-crimson-velvet.jpg';
      isExact = true;
    } else {
      heroImage = '/assets/case1-salon-obsidian-gold.jpg';
      isExact =
        fabric.id === 'fab-official-plum-song' || fabric.id === 'fab-song-obsidian-gold';
    }
    previewBadge = `${scene.shortName} · ${fabric.shortName}`;
  } else if (isUniform) {
    if (scene.id === 'scene-bund-protocol') {
      heroImage =
        fabric.id === 'fab-shikumen-stone-gray'
          ? '/assets/case2-lujiazui-stonegray.jpg'
          : fabric.id === 'fab-shanghai-pine-green'
            ? '/assets/case2-lujiazui-pinegreen.jpg'
            : '/assets/case2-protocol-navy.jpg';
      isExact = fabric.id === 'fab-bund-navy-wool130';
    } else if (scene.id === 'scene-studio-minimal') {
      heroImage = '/assets/official1-studio-jacket.jpg';
      isExact = false;
    } else {
      heroImage =
        fabric.id === 'fab-shikumen-stone-gray'
          ? '/assets/case2-lujiazui-stonegray.jpg'
          : fabric.id === 'fab-shanghai-pine-green'
            ? '/assets/case2-lujiazui-pinegreen.jpg'
            : '/assets/case2-lujiazui-navy.jpg';
      isExact = [
        'fab-bund-navy-wool130',
        'fab-shikumen-stone-gray',
        'fab-shanghai-pine-green',
      ].includes(fabric.id);
    }
    previewBadge = `${scene.shortName} · ${fabric.shortName}`;
  } else {
    // Evening gown
    if (scene.id === 'scene-outdoor-stage') {
      heroImage = '/assets/courtyard-garden-soiree.jpg';
      isExact = true;
    } else if (scene.id === 'scene-jingan-salon') {
      heroImage = '/assets/case1-salon-obsidian-gold.jpg';
      isExact = fabric.id === 'fab-song-obsidian-gold';
    } else if (fabric.id === 'fab-suzhou-moonlight-white') {
      heroImage = '/assets/case1-bund-moonlight-white.jpg';
      isExact = true;
    } else if (fabric.id === 'fab-xiangyun-crimson-velvet') {
      heroImage = '/assets/case1-bund-crimson-velvet.jpg';
      isExact = true;
    } else {
      heroImage = '/assets/case1-bund-obsidian-gold.jpg';
      isExact = fabric.id === 'fab-song-obsidian-gold';
    }
    previewBadge = `${scene.shortName} · ${fabric.shortName}`;
  }

  const craftCloseupImage =
    crafts.length > 0
      ? crafts[0].closeupImage
      : isUniform || isOfficialMensJacket
        ? '/assets/case2-craft-detail.jpg'
        : '/assets/case1-craft-detail.jpg';

  const fabricTintOverlay = isExact
    ? scene.lighting.overlayGradient
    : `linear-gradient(155deg, ${fabric.pbr.baseColor}1f 0%, transparent 58%, ${fabric.pbr.sheenColor}1a 100%)`;

  // Calibrated hotspots per photography composition
  const isRightFramedStudio = heroImage === '/assets/official1-studio-jacket.jpg';
  const isRightFramedStage = heroImage === '/assets/courtyard-garden-soiree.jpg';

  const collarPin = isRightFramedStudio
    ? { x: 66, y: 29, zoomScale: 2.0, label: pattern.collarType }
    : isRightFramedStage
      ? { x: 68, y: 37, zoomScale: 2.0, label: pattern.collarType }
      : isUniform
        ? { x: 42, y: 48, zoomScale: 2.0, label: pattern.collarType }
        : { x: 50, y: 41, zoomScale: 2.0, label: pattern.collarType };

  const fabricPin = isRightFramedStudio
    ? { x: 65, y: 46, zoomScale: 2.0, label: `${fabric.shortName} · ${fabric.gsm}g/m²` }
    : isRightFramedStage
      ? { x: 67, y: 58, zoomScale: 2.0, label: `${fabric.shortName} · ${fabric.gsm}g/m²` }
      : isUniform
        ? { x: 45, y: 62, zoomScale: 2.0, label: `${fabric.shortName} · ${fabric.gsm}g/m²` }
        : { x: 51, y: 58, zoomScale: 2.0, label: `${fabric.shortName} · ${fabric.gsm}g/m²` };

  const easePin = isRightFramedStudio
    ? { x: 69, y: 54, zoomScale: 2.0, label: pattern.easeAllowance }
    : isRightFramedStage
      ? { x: 63, y: 48, zoomScale: 2.0, label: pattern.easeAllowance }
      : isUniform
        ? { x: 58, y: 55, zoomScale: 2.0, label: pattern.easeAllowance }
        : { x: 53, y: 69, zoomScale: 2.0, label: pattern.easeAllowance };

  const hotspots: ResolvedStageVisual['hotspots'] = [
    {
      id: `hs-collar-${pattern.id}`,
      title: pattern.collarType,
      subtitle: pattern.silhouette,
      badge: '领型与廓形',
      hotspot: collarPin,
      closeupImage: craftCloseupImage,
    },
    {
      id: `hs-fabric-${fabric.id}`,
      title: `${fabric.name}（${fabric.gsm}g/m²）`,
      subtitle: `${fabric.composition} · ${fabric.drape}`,
      badge: '核心面料',
      hotspot: fabricPin,
      closeupImage: craftCloseupImage,
    },
    {
      id: `hs-ease-${pattern.id}`,
      title: crafts[0]?.name ?? '体态松弛与工艺细节',
      subtitle: pattern.easeAllowance,
      badge: crafts[0]?.heritageLevel ?? '松弛余量',
      hotspot: easePin,
      closeupImage: crafts[0]?.closeupImage ?? craftCloseupImage,
    },
  ];

  return {
    heroImage,
    craftCloseupImage,
    isExactPhotographicVariant: isExact,
    previewBadge,
    ambientFilter: scene.lighting.cssFilter,
    fabricTintOverlay,
    hotspots,
  };
}
