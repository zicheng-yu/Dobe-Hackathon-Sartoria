import { AnimatePresence, motion } from 'framer-motion';
import { Plus, RotateCcw, X } from 'lucide-react';
import type { ResolvedStageVisual } from '../engine/visualResolver';
import type {
  ConfigurationState,
  CraftAsset,
  FabricAsset,
  PatternAsset,
  SceneEnvironment,
} from '../types/sartoria';
import { AtelierBlueprintSVG } from './AtelierBlueprintSVG';
import { FabricSwatch3D } from './FabricSwatch3D';

interface StageViewportProps {
  pattern: PatternAsset;
  fabric: FabricAsset;
  crafts: CraftAsset[];
  scene: SceneEnvironment;
  scenes: SceneEnvironment[];
  matchedSceneIds: string[];
  config: ConfigurationState;
  ruleScore: number;
  visual: ResolvedStageVisual;
  changeFeedback: string | null;
  onChangeView: (view: ConfigurationState['activeView']) => void;
  onSelectScene: (sceneId: string) => void;
  onFocusHotspot: (hotspotId: string | null) => void;
}

export function StageViewport({
  pattern,
  fabric,
  crafts,
  scene,
  scenes,
  matchedSceneIds,
  config,
  ruleScore,
  visual,
  changeFeedback,
  onChangeView,
  onSelectScene,
  onFocusHotspot,
}: StageViewportProps) {
  const focusedPin = visual.hotspots.find((h) => h.id === config.focusedHotspotId) ?? null;

  return (
    <section className="stage-pane" aria-label="交互式场景选配大舞台">
      {/* Top Bar: Live Selection Summary + View Mode Switcher */}
      <div className="stage-bar-top">
        <div className="stage-minimal-pill">
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: fabric.pbr.baseColor,
              border: '1px solid rgba(0,0,0,0.18)',
              flexShrink: 0,
            }}
          />
          <span>{fabric.shortName}</span>
          <span style={{ color: 'var(--ink-muted)' }}>·</span>
          <span>{scene.shortName}</span>
          <span style={{ color: 'var(--ink-muted)' }}>·</span>
          <span>匹配 {ruleScore}</span>
        </div>

        <div className="segmented" role="tablist" aria-label="视图切换">
          {(
            [
              { id: 'scene_look', label: '实景' },
              { id: 'craft_3d', label: '3D 面料' },
              { id: 'blueprint', label: '版型图' },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={config.activeView === v.id}
              className={`seg-btn ${config.activeView === v.id ? 'active' : ''}`}
              onClick={() => onChangeView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Tactile Change Toast on Stage */}
      <AnimatePresence>
        {changeFeedback && (
          <motion.div
            key={changeFeedback}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="stage-feedback-toast"
            role="status"
            aria-live="polite"
          >
            <span className="status-dot dot-pass" />
            <span>{changeFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Stage Viewport */}
      <div className="stage-viewport">
        {config.activeView === 'scene_look' && (
          <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            {/* Keep <img> stably mounted — never unmount on swatch change */}
            <div
              style={{
                width: '100%',
                height: '100%',
                transform: focusedPin ? `scale(${focusedPin.hotspot.zoomScale})` : 'scale(1)',
                transformOrigin: focusedPin
                  ? `${focusedPin.hotspot.x}% ${focusedPin.hotspot.y}%`
                  : '50% 45%',
                transition: 'transform 380ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                position: 'relative',
              }}
            >
              <img
                src={visual.heroImage}
                alt={`${pattern.name} · ${scene.name}`}
                className="stage-photo"
                style={{
                  filter: visual.ambientFilter,
                  transition: 'filter 240ms ease',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: visual.fabricTintOverlay === 'none' ? 'transparent' : visual.fabricTintOverlay,
                  mixBlendMode: 'soft-light',
                  pointerEvents: 'none',
                  transition: 'background 260ms ease',
                }}
              />
            </div>

            {!focusedPin &&
              visual.hotspots.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="hotspot-ring"
                  style={{ left: `${item.hotspot.x}%`, top: `${item.hotspot.y}%` }}
                  onClick={() => onFocusHotspot(item.id)}
                  title={item.hotspot.label}
                  aria-label={`查看：${item.hotspot.label}`}
                >
                  <Plus size={13} strokeWidth={2} />
                </button>
              ))}

            {focusedPin && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => onFocusHotspot(null)}
                style={{
                  position: 'absolute',
                  right: 22,
                  top: 70,
                  zIndex: 18,
                  background: 'rgba(255,255,255,0.92)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <RotateCcw size={13} />
                <span>返回全景</span>
              </button>
            )}

            <AnimatePresence>
              {focusedPin && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="hotspot-card"
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <span className="tag-minimal">{focusedPin.badge}</span>
                    <button
                      type="button"
                      className="util-btn"
                      onClick={() => onFocusHotspot(null)}
                      aria-label="关闭详情"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <img
                    src={focusedPin.closeupImage}
                    alt={focusedPin.title}
                    style={{
                      width: '100%',
                      height: 112,
                      objectFit: 'cover',
                      borderRadius: 8,
                      marginBottom: 9,
                    }}
                  />
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#111111' }}>
                    {focusedPin.title}
                  </div>
                  <p style={{ fontSize: 12.5, color: '#55555a', marginTop: 4, lineHeight: 1.55 }}>
                    {focusedPin.subtitle}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {config.activeView === 'craft_3d' && (
          <div className="craft-split">
            <div className="craft-box">
              <div style={{ position: 'relative', flex: 1, minHeight: 240 }}>
                <img
                  src={visual.craftCloseupImage}
                  alt="工艺微距"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-hairline)' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {crafts.length > 0 ? crafts.map((c) => c.shortName).join(' · ') : '极简净面精工'}
                </div>
              </div>
            </div>

            <div className="craft-box">
              <FabricSwatch3D fabric={fabric} scene={scene} />
              <div
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid var(--border-hairline)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12.5,
                }}
              >
                <span style={{ fontWeight: 600 }}>{fabric.shortName}</span>
                <span style={{ color: 'var(--ink-muted)' }}>
                  {fabric.gsm}g/m² · {fabric.drape}
                </span>
              </div>
            </div>
          </div>
        )}

        {config.activeView === 'blueprint' && (
          <AtelierBlueprintSVG pattern={pattern} fabric={fabric} crafts={crafts} />
        )}
      </div>

      {/* Bottom Floating Scene Dock — ordered by relevance to current requirement */}
      <div className="scene-float-dock" role="group" aria-label="场景切换">
        {scenes.map((s) => {
          const isMatched = matchedSceneIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={`scene-dock-btn ${config.sceneId === s.id ? 'active' : ''}`}
              onClick={() => onSelectScene(s.id)}
              title={isMatched ? '适配当前需求的推荐场景' : s.name}
            >
              <span>{s.shortName}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
