import { ArrowUpRight, ChevronDown, Download, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { HISTORICAL_CASES } from '../data/cases';
import { CRAFTS } from '../data/crafts';
import { FABRICS } from '../data/fabrics';
import { PATTERNS } from '../data/patterns';
import { STYLE_PACKS } from '../data/stylePacks';
import type { StylePackId } from '../types/sartoria';
import { buildAssetCatalogCsv, downloadTextFile } from '../utils/exporters';

type AssetTab = 'patterns' | 'fabrics' | 'crafts' | 'cases';

interface AssetKnowledgeBaseProps {
  activeStylePackId: StylePackId;
  onChangeStylePack: (id: StylePackId) => void;
  onTryPatternInStudio: (patternId: string) => void;
  onTryFabricInStudio: (fabricId: string) => void;
  onTryCraftInStudio: (craftId: string) => void;
  onTryCaseInStudio: (caseId: string) => void;
}

export function AssetKnowledgeBase({
  activeStylePackId,
  onChangeStylePack,
  onTryPatternInStudio,
  onTryFabricInStudio,
  onTryCraftInStudio,
  onTryCaseInStudio,
}: AssetKnowledgeBaseProps) {
  const [assetTab, setAssetTab] = useState<AssetTab>('patterns');
  const [query, setQuery] = useState('');
  const [packFilter, setPackFilter] = useState<'all' | StylePackId>('all');

  const q = query.trim().toLowerCase();

  const filteredPatterns = useMemo(
    () =>
      PATTERNS.filter((p) => {
        if (packFilter !== 'all' && p.stylePackId !== packFilter) return false;
        if (!q) return true;
        return `${p.code} ${p.name} ${p.shortSpec} ${p.silhouette} ${p.styleTags.join(' ')}`
          .toLowerCase()
          .includes(q);
      }),
    [packFilter, q]
  );

  const filteredFabrics = useMemo(
    () =>
      FABRICS.filter((f) => {
        if (packFilter !== 'all' && f.stylePackId !== packFilter) return false;
        if (!q) return true;
        return `${f.code} ${f.name} ${f.composition} ${f.weave} ${f.styleTags.join(' ')}`
          .toLowerCase()
          .includes(q);
      }),
    [packFilter, q]
  );

  const filteredCrafts = useMemo(
    () =>
      CRAFTS.filter((c) => {
        if (packFilter !== 'all' && c.stylePackId !== packFilter) return false;
        if (!q) return true;
        return `${c.code} ${c.name} ${c.heritageLevel} ${c.placement} ${c.styleTags.join(' ')}`
          .toLowerCase()
          .includes(q);
      }),
    [packFilter, q]
  );

  const filteredCases = useMemo(
    () =>
      HISTORICAL_CASES.filter((hc) => {
        if (packFilter !== 'all' && hc.stylePackId !== packFilter) return false;
        if (!q) return true;
        return `${hc.code} ${hc.title} ${hc.clientProfile} ${hc.styleTags.join(' ')}`
          .toLowerCase()
          .includes(q);
      }),
    [packFilter, q]
  );

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div>
          <h1 className="page-h1">定制资产知识库</h1>
          <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4 }}>
            模拟静态定制资产 · 来源：上海服装集团海派定制公开案例结构化整理 · 仅用于企划辅助原型演示，不接入真实生产 API
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="clean-select"
            style={{ width: 220, padding: '8px 12px', fontSize: 12.5 }}
            value={activeStylePackId}
            onChange={(e) => {
              const id = e.target.value as StylePackId;
              onChangeStylePack(id);
              setPackFilter(id === 'shanghai-haipai' ? 'all' : id);
            }}
            aria-label="企业风格包切换"
          >
            {STYLE_PACKS.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              downloadTextFile(
                'Sartoria-AI-定制资源分类清单.csv',
                buildAssetCatalogCsv(),
                'text/csv;charset=utf-8'
              )
            }
          >
            <Download size={14} />
            <span>导出资源清单</span>
          </button>
        </div>
      </div>

      {/* Minimal Category Segmented Bar + Search */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 22,
        }}
      >
        <div className="segmented segmented-solid">
          {(
            [
              { id: 'patterns', label: `版型 (${PATTERNS.length})` },
              { id: 'fabrics', label: `面料 (${FABRICS.length})` },
              { id: 'crafts', label: `工艺 (${CRAFTS.length})` },
              { id: 'cases', label: `历史案例 (${HISTORICAL_CASES.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`seg-btn ${assetTab === t.id ? 'active' : ''}`}
              onClick={() => setAssetTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            color="#86868b"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            className="clean-input"
            style={{ paddingLeft: 34, width: 240, borderRadius: 999, paddingTop: 8, paddingBottom: 8 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索版型、面料、工艺…"
          />
        </div>
      </div>

      {assetTab === 'patterns' && (
        <div className="clean-grid">
          {filteredPatterns.map((pat) => (
            <div key={pat.id} className="asset-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-muted)' }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{pat.code}</span>
                <span>{pat.category}</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>{pat.name}</h3>
              <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>{pat.shortSpec}</div>

              <details className="disclosure" style={{ marginTop: 4, paddingTop: 8 }}>
                <summary>
                  <span>版型与松量规范</span>
                  <ChevronDown size={13} />
                </summary>
                <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 8, lineHeight: 1.6 }}>
                  <div>结构：{pat.silhouette}</div>
                  <div>领型：{pat.collarType}</div>
                  <div>余量：{pat.easeAllowance}</div>
                </div>
              </details>

              <button
                type="button"
                className="btn-outline"
                style={{ marginTop: 'auto', width: '100%' }}
                onClick={() => onTryPatternInStudio(pat.id)}
              >
                <span>在选配工作室试用</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {assetTab === 'fabrics' && (
        <div className="clean-grid">
          {filteredFabrics.map((fab) => (
            <div key={fab.id} className="asset-card">
              <div
                style={{
                  height: 60,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${fab.pbr.baseColor}, ${fab.pbr.accentColor} 60%, ${fab.pbr.sheenColor})`,
                  border: '1px solid rgba(0,0,0,0.08)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-muted)' }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{fab.code}</span>
                <span>
                  {fab.gsm}g/m² · {fab.drape}
                </span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>{fab.name}</h3>
              <div style={{ fontSize: 12.5, color: 'var(--ink-secondary)' }}>{fab.composition}</div>

              <details className="disclosure" style={{ marginTop: 4, paddingTop: 8 }}>
                <summary>
                  <span>护理与使用规范</span>
                  <ChevronDown size={13} />
                </summary>
                <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 8, lineHeight: 1.55 }}>
                  {fab.careAndMoqNote}
                </p>
              </details>

              <button
                type="button"
                className="btn-outline"
                style={{ marginTop: 'auto', width: '100%' }}
                onClick={() => onTryFabricInStudio(fab.id)}
              >
                <span>在 3D 面料室查看</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {assetTab === 'crafts' && (
        <div className="clean-grid">
          {filteredCrafts.map((craft) => (
            <div key={craft.id} className="asset-card">
              <img
                src={craft.closeupImage}
                alt={craft.name}
                style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 10 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-muted)' }}>
                <span>{craft.heritageLevel}</span>
                <span>+{craft.extraLeadDays} 工作日</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>{craft.name}</h3>
              <p style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.55 }}>
                {craft.highlightCopy}
              </p>
              <button
                type="button"
                className="btn-outline"
                style={{ marginTop: 'auto', width: '100%' }}
                onClick={() => onTryCraftInStudio(craft.id)}
              >
                <span>叠加到当前方案</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {assetTab === 'cases' && (
        <div className="clean-grid">
          {filteredCases.map((hc) => (
            <div key={hc.id} className="asset-card">
              <img
                src={hc.heroImage}
                alt={hc.title}
                style={{ width: '100%', height: 154, objectFit: 'cover', borderRadius: 10 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-muted)' }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{hc.code}</span>
                <span>{hc.referenceCycle}</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>{hc.title}</h3>
              <p style={{ fontSize: 12.5, color: 'var(--ink-secondary)', lineHeight: 1.55 }}>
                {hc.reviewSummary}
              </p>
              <button
                type="button"
                className="btn-black"
                style={{ marginTop: 'auto', width: '100%' }}
                onClick={() => onTryCaseInStudio(hc.id)}
              >
                <span>复用该案例资产</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
