import type { CraftAsset, FabricAsset, PatternAsset } from '../types/sartoria';

interface AtelierBlueprintSVGProps {
  pattern: PatternAsset;
  fabric: FabricAsset;
  crafts: CraftAsset[];
}

export function AtelierBlueprintSVG({ pattern, fabric, crafts }: AtelierBlueprintSVGProps) {
  const { silhouetteType, collarStyle, easeHighlight, accentTrimHex, innerDressHex } =
    pattern.blueprintConfig;
  const hasFrogButtons = crafts.some((c) => c.id === 'crf-haipai-pipa-button');
  const hasStarlight = crafts.some((c) => c.id === 'crf-plum-starlight-motif');
  const hasContrastPiping = crafts.some((c) => c.id === 'crf-contrast-piping-cuff');
  const hasFullCanvas = crafts.some((c) => c.id === 'crf-full-canvas-guiba');

  const baseHex = fabric.pbr.baseColor;
  const accentHex = fabric.pbr.accentColor;
  const trimHex = hasContrastPiping ? accentTrimHex ?? '#d94d7d' : '#111111';
  const isGown = silhouetteType === 'gown_column' || silhouetteType === 'gown_cape';
  const isStageSet = silhouetteType === 'stage_two_piece';
  const isJacket =
    silhouetteType === 'jacket_h_cross_collar' ||
    silhouetteType === 'jacket_h_low_collar' ||
    silhouetteType === 'jacket_h_shawl' ||
    silhouetteType === 'jacket_h_dropped';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '72px 24px 80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        viewBox="0 0 760 500"
        width="100%"
        height="100%"
        style={{
          maxHeight: 520,
          background: '#ffffff',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: 16,
        }}
        role="img"
        aria-label={`参数化结构图纸：${pattern.name}`}
      >
        <defs>
          <pattern
            id="bpLightWeave"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <rect width="10" height="10" fill={baseHex} fillOpacity="0.12" />
            <line x1="0" y1="0" x2="0" y2="10" stroke={baseHex} strokeWidth="1" strokeOpacity="0.22" />
          </pattern>
        </defs>

        {/* Center Axis */}
        <line
          x1="340"
          y1="44"
          x2="340"
          y2="458"
          stroke="rgba(17, 17, 17, 0.1)"
          strokeDasharray="4 4"
        />

        {/* Minimal Spec Header */}
        <text x="32" y="42" fill="#86868b" fontSize="11" letterSpacing="1.5">
          {pattern.code} · TECHNICAL PATTERN BLUEPRINT
        </text>
        <text x="32" y="64" fill="#111111" fontSize="15" fontWeight="600">
          {pattern.name}
        </text>

        {/* Silhouette 1: Official Cases 1, 2, 4 — Relaxed Modern Chinese H-Line Jacket */}
        {isJacket && (
          <g transform="translate(-40, 12)">
            {/* Sleeves (Micro-drop flat vs Natural dropped for sloped shoulders) */}
            <path
              d={
                silhouetteType === 'jacket_h_dropped'
                  ? 'M 304 114 C 282 124, 272 152, 258 268 L 288 274 L 316 178 Z M 456 114 C 478 124, 488 152, 502 268 L 472 274 L 444 178 Z'
                  : 'M 308 112 L 266 268 L 296 274 L 320 174 Z M 452 112 L 494 268 L 464 274 L 440 174 Z'
              }
              fill="url(#bpLightWeave)"
              stroke="#111111"
              strokeWidth="1.4"
            />

            {/* H-Line Straight Body (Mid-Hip Length, Relaxed Front Ease) */}
            <path
              d={
                silhouetteType === 'jacket_h_shawl'
                  ? 'M 346 98 L 308 112 L 322 214 L 314 342 L 446 342 L 438 214 L 452 112 L 414 98 Z'
                  : 'M 346 98 L 306 112 L 316 226 L 312 346 L 448 346 L 444 226 L 454 112 L 414 98 Z'
              }
              fill="url(#bpLightWeave)"
              stroke="#111111"
              strokeWidth="1.6"
            />

            {/* Collar: Cross-Collar Open Placket (Case 6) vs Narrow Shawl Lapel (Case 2) vs <=3cm Low Rounded Mandarin Collar (Cases 1 & 4) */}
            {collarStyle === 'cross_open_no_stand' ? (
              <g>
                {/* Stand-free Cross-Collar Open Placket (No Stand Collar, No Exposed Buttons) */}
                <path
                  d="M 346 98 L 378 212 L 378 346 M 414 98 L 382 212 L 382 346"
                  fill="none"
                  stroke="#111111"
                  strokeWidth="1.6"
                />
                <path
                  d="M 346 98 L 358 98 L 384 204 L 384 346 M 414 98 L 402 98 L 376 204 L 376 346"
                  fill="none"
                  stroke="#111111"
                  strokeWidth="0.95"
                  strokeDasharray="3 2"
                />
                {/* Subtle Side Hem Slits */}
                <line x1="312" y1="312" x2="312" y2="346" stroke="#7a6855" strokeWidth="2.2" />
                <line x1="448" y1="312" x2="448" y2="346" stroke="#7a6855" strokeWidth="2.2" />
              </g>
            ) : collarStyle === 'shawl_narrow' ? (
              <g>
                <path
                  d="M 348 98 C 350 144, 366 178, 380 202 C 394 178, 410 144, 412 98 C 402 90, 358 90, 348 98 Z"
                  fill="#ffffff"
                  stroke="#111111"
                  strokeWidth="1.5"
                />
                <path
                  d="M 348 98 C 338 142, 356 184, 380 208 C 404 184, 422 142, 412 98"
                  fill="none"
                  stroke="#111111"
                  strokeWidth="1.4"
                />
                <line x1="380" y1="208" x2="380" y2="346" stroke="#111111" strokeWidth="1.2" />
              </g>
            ) : (
              <g>
                {/* Low <=3cm Rounded Mandarin Collar */}
                <path
                  d="M 352 98 L 354 84 C 368 80, 392 80, 406 84 L 408 98 C 394 103, 366 103, 352 98 Z"
                  fill={baseHex}
                  fillOpacity="0.22"
                  stroke="#111111"
                  strokeWidth="1.6"
                />
                {/* Chinese Placket & Buttons */}
                <line x1="380" y1="101" x2="380" y2="346" stroke="#111111" strokeWidth="1.2" />
                {[128, 162, 196, 230, 264].map((by) => (
                  <circle key={by} cx="386" cy={by} r="2.8" fill="#111111" />
                ))}
              </g>
            )}

            {/* Ergonomic Ease Guide Zone */}
            {silhouetteType === 'jacket_h_cross_collar' ? (
              <g>
                <rect
                  x="294"
                  y="108"
                  width="172"
                  height="78"
                  rx="10"
                  fill="none"
                  stroke="#7a6855"
                  strokeWidth="1.2"
                  strokeDasharray="4 3"
                />
                <text x="380" y="144" textAnchor="middle" fill="#7a6855" fontSize="9.5">
                  肩背与袖笼放量方向（不压肩/抬手不卡）
                </text>
                <text x="380" y="160" textAnchor="middle" fill="#86868b" fontSize="8.8">
                  具体松量数值须由版师量体实测，AI 不凭空报数
                </text>
              </g>
            ) : (
              <g>
                <rect
                  x="332"
                  y="224"
                  width="96"
                  height="74"
                  rx="8"
                  fill="none"
                  stroke="#7a6855"
                  strokeWidth="1.1"
                  strokeDasharray="4 3"
                />
                <text x="380" y="264" textAnchor="middle" fill="#7a6855" fontSize="10">
                  前片腹部宽松余量区
                </text>
              </g>
            )}

            {/* Starlight / Plum Motif Dots for Case 2 */}
            {hasStarlight && (
              <g fill={accentHex}>
                {[
                  [342, 164],
                  [416, 184],
                  [354, 294],
                  [408, 286],
                  [334, 212],
                  [424, 232],
                ].map(([sx, sy]) => (
                  <circle key={`${sx}-${sy}`} cx={sx} cy={sy} r="2.2" />
                ))}
              </g>
            )}
          </g>
        )}

        {/* Silhouette 2: Official Case 3 — Outdoor Stage Two-Piece (Ivory Cropped Jacket + Rose A-Line Ankle Dress) */}
        {isStageSet && (
          <g transform="translate(-40, 6)">
            {/* Sleeveless Wide A-Line Ankle Dress underneath */}
            <path
              d="M 352 104 L 340 220 C 316 300, 290 378, 264 446 L 496 446 C 470 378, 444 300, 420 220 L 408 104 Z"
              fill={innerDressHex ?? '#e04f80'}
              fillOpacity="0.22"
              stroke={innerDressHex ?? '#e04f80'}
              strokeWidth="1.6"
            />
            {/* Generous Wide Sleeves (Arm-Lift Allowance) */}
            <path
              d="M 314 114 L 266 238 L 306 248 L 330 172 Z M 446 114 L 494 238 L 454 248 L 430 172 Z"
              fill="#f8f5ef"
              stroke="#111111"
              strokeWidth="1.4"
            />
            {/* Contrast Rose-Pink Cuffs */}
            <path
              d="M 271 220 L 266 238 L 306 248 L 311 230 Z M 489 220 L 494 238 L 454 248 L 449 230 Z"
              fill={trimHex}
              fillOpacity="0.72"
            />
            {/* Ivory Cropped Micro-H Diagonal-Placket Jacket */}
            <path
              d="M 346 102 L 314 114 L 324 260 L 436 260 L 446 114 L 414 102 Z"
              fill="#faf7f2"
              stroke="#111111"
              strokeWidth="1.5"
            />
            {/* Contrast Rose-Pink Diagonal Placket Piping */}
            <path
              d="M 350 102 C 374 106, 404 126, 424 156 L 424 260"
              fill="none"
              stroke={trimHex}
              strokeWidth="2.6"
            />
            {/* Round Dress Neckline */}
            <path
              d="M 354 102 Q 380 120 406 102"
              fill="none"
              stroke={innerDressHex ?? '#e04f80'}
              strokeWidth="1.6"
            />
            {/* Sit-to-Perform Wide Flare Guide */}
            <line
              x1="280"
              y1="428"
              x2="480"
              y2="428"
              stroke={trimHex}
              strokeWidth="1.1"
              strokeDasharray="4 3"
            />
            <text x="380" y="420" textAnchor="middle" fill="#a8335c" fontSize="10">
              大 A 摆高放量 · 坐奏舒展不紧绷
            </text>
          </g>
        )}

        {/* Silhouette 3: Evening Gown */}
        {isGown && (
          <g transform="translate(-40, 8)">
            <path
              d="M 326 118 L 290 256 L 310 262 L 336 168 Z M 434 118 L 470 256 L 450 262 L 424 168 Z"
              fill="url(#bpLightWeave)"
              stroke="#111111"
              strokeWidth="1.3"
            />
            <path
              d="M 352 102 L 326 118 L 338 202 C 330 264, 320 354, 308 446 L 452 446 C 440 354, 430 264, 422 202 L 434 118 L 408 102 Z"
              fill="url(#bpLightWeave)"
              stroke="#111111"
              strokeWidth="1.6"
            />
            <path
              d="M 354 102 L 357 84 C 370 80, 390 80, 403 84 L 406 102 Z"
              fill={baseHex}
              fillOpacity="0.25"
              stroke="#111111"
              strokeWidth="1.5"
            />
            <path
              d="M 380 103 C 396 112, 412 128, 426 154 L 424 220"
              fill="none"
              stroke="#111111"
              strokeWidth="1.5"
            />
            {hasFrogButtons && (
              <g fill="#111111">
                <circle cx="394" cy="116" r="2.6" />
                <circle cx="408" cy="130" r="2.6" />
                <circle cx="420" cy="146" r="2.6" />
              </g>
            )}
          </g>
        )}

        {/* Silhouette 4: Corporate Tailored Suit */}
        {!isJacket && !isStageSet && !isGown && (
          <g transform="translate(-40, 8)">
            <path
              d="M 332 288 L 326 446 L 368 446 L 378 332 L 382 332 L 392 446 L 434 446 L 428 288 Z"
              fill="url(#bpLightWeave)"
              stroke="#111111"
              strokeWidth="1.3"
            />
            <path
              d="M 312 118 L 280 272 L 308 278 L 328 174 Z M 448 118 L 480 272 L 452 278 L 432 174 Z"
              fill="url(#bpLightWeave)"
              stroke="#111111"
              strokeWidth="1.3"
            />
            <path
              d="M 348 102 L 312 118 L 326 208 L 318 304 L 378 298 L 380 282 L 382 298 L 442 304 L 434 208 L 448 118 L 412 102 Z"
              fill="url(#bpLightWeave)"
              stroke="#111111"
              strokeWidth="1.6"
            />
            <path
              d="M 352 102 L 355 86 C 368 82, 392 82, 405 86 L 408 102 L 380 128 Z"
              fill={baseHex}
              fillOpacity="0.2"
              stroke="#111111"
              strokeWidth="1.5"
            />
            <line x1="380" y1="128" x2="380" y2="286" stroke="#111111" strokeWidth="1.3" />
            {hasFullCanvas && (
              <path
                d="M 326 146 Q 348 168 370 198 M 434 146 Q 412 168 390 198"
                fill="none"
                stroke="#7a6855"
                strokeWidth="1.1"
                strokeDasharray="3 2"
              />
            )}
          </g>
        )}

        {/* Right Side Minimalist Technical Callouts */}
        <g fontSize="11">
          <line x1="392" y1="100" x2="496" y2="100" stroke="#111111" strokeWidth="0.9" />
          <circle cx="392" cy="100" r="2.2" fill="#111111" />
          <text x="506" y="96" fill="#86868b" fontSize="10.5">
            领型规范
          </text>
          <text x="506" y="113" fill="#111111" fontWeight="500">
            {pattern.collarType.slice(0, 20)}
          </text>

          <line x1="422" y1="176" x2="496" y2="176" stroke="#111111" strokeWidth="0.9" />
          <circle cx="422" cy="176" r="2.2" fill="#111111" />
          <text x="506" y="172" fill="#86868b" fontSize="10.5">
            版型与松量
          </text>
          <text x="506" y="189" fill="#111111" fontWeight="500">
            {easeHighlight ?? pattern.shortSpec}
          </text>

          <line x1="414" y1="262" x2="496" y2="262" stroke="#111111" strokeWidth="0.9" />
          <circle cx="414" cy="262" r="2.2" fill="#111111" />
          <text x="506" y="258" fill="#86868b" fontSize="10.5">
            主面料规格
          </text>
          <text x="506" y="275" fill="#111111" fontWeight="500">
            {fabric.shortName} · {fabric.gsm}g/m² · {fabric.drape}
          </text>

          <text x="506" y="330" fill="#86868b" fontSize="10.5">
            长度比例
          </text>
          <text x="506" y="347" fill="#111111" fontWeight="500">
            {pattern.lengthRatio}
          </text>

          <text x="506" y="392" fill="#86868b" fontSize="10.5">
            已叠加细节（{crafts.length}）
          </text>
          <text x="506" y="409" fill="#48484a">
            {crafts.length > 0 ? crafts.map((c) => c.shortName).join(' · ') : '净面极简精工'}
          </text>
        </g>

        {/* Bottom Color Swatch Key */}
        <g transform="translate(32, 446)">
          <circle cx="10" cy="10" r="8" fill={baseHex} stroke="rgba(0,0,0,0.16)" />
          <circle cx="32" cy="10" r="8" fill={accentHex} stroke="rgba(0,0,0,0.16)" />
          <text x="52" y="14" fill="#86868b" fontSize="10.5">
            仅作企划结构参考 · CAD 定版、具体松量与核色均由版师人工完成
          </text>
        </g>
      </svg>
    </div>
  );
}
