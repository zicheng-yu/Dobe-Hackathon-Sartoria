import { ArrowLeft, ArrowUpRight, ChevronDown, Download, Search } from 'lucide-react';
import { useState } from 'react';
import { ASSET_SOURCE_LABELS, DECISION_CASE_REFERENCES, DECISION_CATALOG, SIMULATED_CARE_LABELS } from '../data/decisionCatalog';
import { FABRICS } from '../data/fabrics';
import { STYLE_PACKS } from '../data/stylePacks';
import type { AssetSource } from '../types/decisions';
import type { StylePackId } from '../types/sartoria';
import { buildAssetCatalogCsv, downloadTextFile } from '../utils/exporters';

type AssetTab = 'patterns' | 'fabrics' | 'crafts' | 'cases';

const activeFabricIds = new Set(DECISION_CATALOG.fabrics.map(({ asset }) => asset.id));
const visualFabrics = FABRICS.filter((fabric) => !activeFabricIds.has(fabric.id));
const catalogCount = Object.values(DECISION_CATALOG).reduce((sum, items) => sum + items.length, 0);

function SourceReferences({
  code,
  source,
  references = [],
}: {
  code: string;
  source: AssetSource;
  references?: readonly AssetSource[];
}) {
  return (
    <>
      <div>
        来源：{ASSET_SOURCE_LABELS[source.kind]} · {source.reference}
      </div>
      {references.map((reference) => {
        const link = reference.reference.match(/^(.*?)\s+(https:\/\/\S+)$/);
        return (
          <div key={reference.reference}>
            参考：
            {link ? (
              <a href={link[2]} target="_blank" rel="noreferrer" className="doc-link">
                {link[1]}
              </a>
            ) : (
              reference.reference
            )}
          </div>
        );
      })}
      <div className="asset-card-code">{code}</div>
    </>
  );
}

function CaseCatalogCard({
  record,
  onTry,
}: {
  record: (typeof DECISION_CASE_REFERENCES)[number];
  onTry: (id: string) => void;
}) {
  const { asset, source, active } = record;
  return (
    <div className="asset-card">
      <img
        src={asset.heroImage}
        alt={asset.title}
        style={{ width: '100%', height: 152, objectFit: 'cover', borderRadius: 10 }}
      />
      <div className="asset-card-kicker">
        <span>{asset.clientProfile}</span>
        <span>{active ? asset.referenceCycle : '归档参考'}</span>
      </div>
      <h3 className="asset-card-title">{asset.title}</h3>
      <p className="asset-card-desc">{asset.reviewSummary}</p>
      <details className="disclosure" style={{ marginTop: 2, paddingTop: 8 }}>
        <summary>
          <span>详情</span>
          <ChevronDown size={13} />
        </summary>
        <div className="asset-card-details">
          <div>规模：{asset.groupSize}</div>
          <SourceReferences code={asset.code} source={source} />
        </div>
      </details>
      <button
        type="button"
        className="btn-outline"
        style={{ marginTop: 'auto', width: '100%' }}
        onClick={() => onTry(asset.id)}
      >
        <span>复用该案例</span>
        <ArrowUpRight size={13} />
      </button>
    </div>
  );
}

interface AssetKnowledgeBaseProps {
  activeStylePackId: StylePackId;
  onChangeStylePack: (id: StylePackId) => void;
  onBackToFlow: () => void;
  onTryPatternInStudio: (patternId: string) => void;
  onTryFabricInStudio: (fabricId: string) => void;
  onTryCraftInStudio: (craftId: string) => void;
  onTryCaseInStudio: (caseId: string) => void;
}

export function AssetKnowledgeBase({
  activeStylePackId,
  onChangeStylePack,
  onBackToFlow,
  onTryPatternInStudio,
  onTryFabricInStudio,
  onTryCraftInStudio,
  onTryCaseInStudio,
}: AssetKnowledgeBaseProps) {
  const [assetTab, setAssetTab] = useState<AssetTab>('patterns');
  const [query, setQuery] = useState('');
  const [packFilter, setPackFilter] = useState<'all' | StylePackId>('all');

  const q = query.trim().toLowerCase();
  function visible(
    asset: { id: string; code: string; stylePackId: StylePackId; styleTags: string[] },
    ...terms: string[]
  ) {
    return (
      (packFilter === 'all' || asset.stylePackId === packFilter) &&
      [asset.id, asset.code, ...asset.styleTags, ...terms].join(' ').toLowerCase().includes(q)
    );
  }
  const filteredPatterns = DECISION_CATALOG.patterns.filter(({ asset, source }) =>
    visible(asset, asset.name, asset.shortSpec, asset.silhouette, ASSET_SOURCE_LABELS[source.kind], source.reference)
  );
  const filteredFabrics = DECISION_CATALOG.fabrics.filter(({ asset, profile, source }) =>
    visible(
      asset,
      asset.name,
      asset.composition,
      asset.weave,
      asset.careAndMoqNote,
      ASSET_SOURCE_LABELS[source.kind],
      source.reference,
      ...(profile.publicReferences ?? []).map(
        (reference) => `${ASSET_SOURCE_LABELS[reference.kind]} ${reference.reference}`
      )
    )
  );
  const filteredCrafts = DECISION_CATALOG.crafts.filter(({ asset, source }) =>
    visible(asset, asset.name, asset.heritageLevel, asset.placement, ASSET_SOURCE_LABELS[source.kind], source.reference)
  );
  const filteredCases = DECISION_CASE_REFERENCES.filter(({ asset, source }) =>
    visible(asset, asset.title, asset.clientProfile, ASSET_SOURCE_LABELS[source.kind], source.reference)
  );
  const archivedCases = filteredCases.filter(({ active }) => !active);
  const filteredVisualFabrics = visualFabrics.filter((asset) =>
    visible(asset, asset.name, asset.composition, asset.weave)
  );
  const searchCount = {
    patterns: filteredPatterns.length,
    fabrics: filteredFabrics.length + filteredVisualFabrics.length,
    crafts: filteredCrafts.length,
    cases: filteredCases.length,
  }[assetTab];

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <h1 className="page-h1">定制资产库</h1>
          <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{catalogCount} 项</span>
          <button type="button" className="btn-text" onClick={onBackToFlow}>
            <ArrowLeft size={14} />
            <span>返回当前流程</span>
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="clean-select"
            style={{ width: 'auto', minWidth: 220, padding: '9px 14px', fontSize: 13 }}
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
            <span>导出清单</span>
          </button>
        </div>
      </div>

      {searchCount === 0 && <p role="status">当前分类没有符合条件的资产。</p>}

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
              { id: 'patterns', label: `版型 (${DECISION_CATALOG.patterns.length})` },
              { id: 'fabrics', label: `面料 (${DECISION_CATALOG.fabrics.length})` },
              { id: 'crafts', label: `工艺 (${DECISION_CATALOG.crafts.length})` },
              { id: 'cases', label: `案例 (${DECISION_CATALOG.cases.length})` },
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
            color="#86878f"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            className="clean-input"
            style={{ paddingLeft: 34, width: 240, borderRadius: 999, paddingTop: 8, paddingBottom: 8, fontSize: 13 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索名称、特点或面料…"
            aria-label="搜索定制资产"
          />
        </div>
      </div>

      {assetTab === 'patterns' && (
        <div className="clean-grid">
          {filteredPatterns.map(({ asset: pat, profile, source }) => (
            <div key={pat.id} className="asset-card">
              <div className="asset-card-kicker">
                <span>{pat.category}</span>
                <span>{profile.quantity.join('–')} 套</span>
              </div>
              <h3 className="asset-card-title">{pat.name}</h3>
              <p className="asset-card-desc">{pat.shortSpec}</p>

              <details className="disclosure" style={{ marginTop: 2, paddingTop: 8 }}>
                <summary>
                  <span>详情</span>
                  <ChevronDown size={13} />
                </summary>
                <div className="asset-card-details">
                  <div>结构：{pat.silhouette}</div>
                  <div>领型：{pat.collarType}</div>
                  <div>余量：{pat.easeAllowance}</div>
                  <SourceReferences code={pat.code} source={source} />
                </div>
              </details>

              <button
                type="button"
                className="btn-outline"
                style={{ marginTop: 'auto', width: '100%' }}
                onClick={() => onTryPatternInStudio(pat.id)}
              >
                <span>在选配室试用</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {assetTab === 'fabrics' && (
        <div className="clean-grid">
          {filteredFabrics.map(({ asset: fab, profile, source }) => (
            <div key={fab.id} className="asset-card">
              <div
                style={{
                  height: 58,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${fab.pbr.baseColor}, ${fab.pbr.accentColor} 60%, ${fab.pbr.sheenColor})`,
                  border: '1px solid var(--border-hairline)',
                }}
              />
              <div className="asset-card-kicker">
                <span>
                  {fab.gsm}g/m² · {fab.drape}
                </span>
                <span>{profile.care ? SIMULATED_CARE_LABELS[profile.care] : '洗护待核'}</span>
              </div>
              <h3 className="asset-card-title">{fab.name}</h3>
              <p className="asset-card-desc">{fab.composition}</p>

              <details className="disclosure" style={{ marginTop: 2, paddingTop: 8 }}>
                <summary>
                  <span>详情</span>
                  <ChevronDown size={13} />
                </summary>
                <div className="asset-card-details">
                  <div>
                    耐皱：{profile.wrinkleResistance === undefined ? '待核' : profile.wrinkleResistance ? '耐皱' : '易皱'} · 织法：{fab.weave}
                  </div>
                  <div>{fab.careAndMoqNote}</div>
                  <SourceReferences code={fab.code} source={source} references={profile.publicReferences} />
                </div>
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

      {assetTab === 'fabrics' && filteredVisualFabrics.length > 0 && (
        <details className="disclosure" style={{ marginTop: 18, paddingTop: 10 }}>
          <summary>
            <span>更多配色参考（{filteredVisualFabrics.length}）</span>
            <ChevronDown size={13} />
          </summary>
          <div className="clean-grid" style={{ marginTop: 12 }}>
            {filteredVisualFabrics.map((fabric) => (
              <div key={fabric.id} className="asset-card">
                <div
                  style={{
                    height: 44,
                    borderRadius: 8,
                    background: `linear-gradient(135deg, ${fabric.pbr.baseColor}, ${fabric.pbr.sheenColor})`,
                  }}
                />
                <h3 className="asset-card-title">{fabric.name}</h3>
                <p className="asset-card-desc">{fabric.composition}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {assetTab === 'crafts' && (
        <div className="clean-grid">
          {filteredCrafts.map(({ asset: craft, source }) => (
            <div key={craft.id} className="asset-card">
              <img
                src={craft.closeupImage}
                alt={craft.name}
                style={{ width: '100%', height: 132, objectFit: 'cover', borderRadius: 10 }}
              />
              <div className="asset-card-kicker">
                <span>{craft.heritageLevel}</span>
                <span>+{craft.extraLeadDays} 工作日</span>
              </div>
              <h3 className="asset-card-title">{craft.name}</h3>
              <p className="asset-card-desc">{craft.highlightCopy}</p>
              <details className="disclosure" style={{ marginTop: 2, paddingTop: 8 }}>
                <summary>
                  <span>详情</span>
                  <ChevronDown size={13} />
                </summary>
                <div className="asset-card-details">
                  <div>部位：{craft.placement}</div>
                  <div>{craft.usageStandard}</div>
                  <SourceReferences code={craft.code} source={source} />
                </div>
              </details>
              <button
                type="button"
                className="btn-outline"
                style={{ marginTop: 'auto', width: '100%' }}
                onClick={() => onTryCraftInStudio(craft.id)}
              >
                <span>叠加到方案</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {assetTab === 'cases' && (
        <div className="clean-grid">
          {filteredCases
            .filter(({ active }) => active)
            .map((record) => (
              <CaseCatalogCard key={record.asset.id} record={record} onTry={onTryCaseInStudio} />
            ))}
        </div>
      )}
      {assetTab === 'cases' && archivedCases.length > 0 && (
        <details className="disclosure" style={{ marginTop: 18, paddingTop: 10 }} open={q ? true : undefined}>
          <summary>
            <span>归档案例参考（{archivedCases.length}）</span>
            <ChevronDown size={13} />
          </summary>
          <div className="clean-grid" style={{ marginTop: 12 }}>
            {archivedCases.map((record) => (
              <CaseCatalogCard key={record.asset.id} record={record} onTry={onTryCaseInStudio} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
