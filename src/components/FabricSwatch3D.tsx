import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { FabricAsset, SceneEnvironment } from '../types/sartoria';

interface FabricSwatch3DProps {
  fabric: FabricAsset;
  scene: SceneEnvironment;
}

function createProceduralFabricTextures(fabric: FabricAsset): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = fabric.pbr.baseColor;
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  const weave = fabric.pbr.weaveType;

  // Fine base warp/weft grain
  const step = weave === 'worsted_twill' || weave === 'wool_silk' ? 6 : 8;
  for (let y = 0; y < size; y += step) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(0, y, size, 1.5);
    bctx.fillStyle = '#969696';
    bctx.fillRect(0, y, size, 2);
  }
  for (let x = 0; x < size; x += step) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(x, 0, 1.5, size);
    bctx.fillStyle = '#6c6c6c';
    bctx.fillRect(x, 0, 2, size);
  }

  if (weave === 'xiangyun_matte') {
    // Organic natural Gambiered Canton Silk (香云纱) matte crinkle grain
    ctx.strokeStyle = fabric.pbr.accentColor;
    ctx.globalAlpha = 0.28;
    bctx.strokeStyle = '#b4b4b4';
    for (let y = 0; y < size; y += 14) {
      ctx.beginPath();
      bctx.beginPath();
      for (let x = 0; x <= size; x += 24) {
        const dy = Math.sin(x * 0.05 + y * 0.08) * 5;
        if (x === 0) {
          ctx.moveTo(x, y + dy);
          bctx.moveTo(x, y + dy);
        } else {
          ctx.lineTo(x, y + dy);
          bctx.lineTo(x, y + dy);
        }
      }
      ctx.stroke();
      bctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (weave === 'silk_subtle_jacquard') {
    // Understated micro-floral tonal silk jacquard for Official Case 6
    const cell = 38;
    ctx.strokeStyle = fabric.pbr.accentColor;
    ctx.fillStyle = fabric.pbr.accentColor;
    bctx.strokeStyle = '#b8b8b8';
    bctx.fillStyle = '#adadad';
    for (let y = 0; y < size + cell; y += cell) {
      for (let x = 0; x < size + cell; x += cell) {
        const offsetX = (y / cell) % 2 === 0 ? 0 : cell / 2;
        const cx = x + offsetX;
        const cy = y;
        ctx.globalAlpha = 0.24;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 8);
        ctx.lineTo(cx + 8, cy);
        ctx.lineTo(cx, cy + 8);
        ctx.lineTo(cx - 8, cy);
        ctx.closePath();
        ctx.stroke();

        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
        ctx.fill();

        bctx.beginPath();
        bctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
        bctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  } else if (weave === 'acetate_jacquard') {
    // Subtle geometric architectural micro-jacquard for Official Case 1
    const cell = 44;
    ctx.strokeStyle = fabric.pbr.accentColor;
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 1.2;
    bctx.strokeStyle = '#bcbcbc';
    bctx.lineWidth = 1.6;
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        ctx.strokeRect(x + 6, y + 6, cell - 12, cell - 12);
        bctx.strokeRect(x + 6, y + 6, cell - 12, cell - 12);
      }
    }
    ctx.globalAlpha = 1;
  } else if (weave === 'worsted_twill') {
    ctx.strokeStyle = fabric.pbr.accentColor;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 2;
    bctx.strokeStyle = '#bcbcbc';
    bctx.lineWidth = 2;
    for (let i = -size; i < size * 2; i += 9) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
      bctx.beginPath();
      bctx.moveTo(i, 0);
      bctx.lineTo(i + size, size);
      bctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (weave === 'song_brocade' || weave === 'silk_damask' || weave === 'velvet_jacquard') {
    const cell = 64;
    ctx.strokeStyle = fabric.pbr.accentColor;
    ctx.fillStyle = fabric.pbr.accentColor;
    bctx.strokeStyle = '#d4d4d4';
    bctx.fillStyle = '#c4c4c4';

    for (let y = 0; y < size + cell; y += cell) {
      for (let x = 0; x < size + cell; x += cell) {
        const offsetX = (y / cell) % 2 === 0 ? 0 : cell / 2;
        const cx = x + offsetX;
        const cy = y;

        ctx.globalAlpha = 0.32;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 22);
        ctx.lineTo(cx + 22, cy);
        ctx.lineTo(cx, cy + 22);
        ctx.lineTo(cx - 22, cy);
        ctx.closePath();
        ctx.stroke();

        bctx.lineWidth = 1.6;
        bctx.beginPath();
        bctx.moveTo(cx, cy - 22);
        bctx.lineTo(cx + 22, cy);
        bctx.lineTo(cx, cy + 22);
        bctx.lineTo(cx - 22, cy);
        bctx.closePath();
        bctx.stroke();

        ctx.globalAlpha = 0.38;
        for (let p = 0; p < 5; p++) {
          const angle = (p * Math.PI * 2) / 5;
          ctx.beginPath();
          ctx.ellipse(
            cx + Math.cos(angle) * 7.5,
            cy + Math.sin(angle) * 7.5,
            5.2,
            2.8,
            angle,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  } else {
    // Satin drape with subtle highlight gradient
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, fabric.pbr.baseColor);
    grad.addColorStop(0.55, fabric.pbr.accentColor);
    grad.addColorStop(1, fabric.pbr.baseColor);
    ctx.globalAlpha = 0.36;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 1;
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.4, 2.4);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2.4, 2.4);

  return { map, bumpMap };
}

export function FabricSwatch3D({ fabric, scene }: FabricSwatch3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState(false);
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0, rotX: -0.22, rotY: 0.2 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 320;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const threeScene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0.15, 4.1);

    const ambientLight = new THREE.AmbientLight(
      new THREE.Color(scene.lighting.ambientColor),
      scene.lighting.ambientIntensity * 1.4
    );
    threeScene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(
      new THREE.Color(scene.lighting.keyLightColor),
      scene.lighting.keyLightIntensity * 1.45
    );
    keyLight.position.set(2.6, 3.2, 3.6);
    threeScene.add(keyLight);

    const rimLight = new THREE.PointLight(new THREE.Color(scene.lighting.rimLightColor), 2.1, 14);
    rimLight.position.set(-3.0, -1.2, 2.6);
    threeScene.add(rimLight);

    const { map, bumpMap } = createProceduralFabricTextures(fabric);
    const geometry = new THREE.PlaneGeometry(3.2, 2.5, 48, 40);
    const basePositions = new Float32Array(geometry.attributes.position.array);

    const material = new THREE.MeshPhysicalMaterial({
      map,
      bumpMap,
      bumpScale: fabric.pbr.weaveType === 'satin_drape' ? 0.012 : 0.032,
      roughness: fabric.pbr.roughness,
      metalness: fabric.pbr.metalness,
      sheen: fabric.pbr.sheen,
      sheenRoughness: fabric.pbr.sheenRoughness,
      sheenColor: new THREE.Color(fabric.pbr.sheenColor),
      side: THREE.DoubleSide,
    });

    const clothMesh = new THREE.Mesh(geometry, material);
    threeScene.add(clothMesh);

    let rafId = 0;
    const start = performance.now();

    const animate = () => {
      const elapsed = (performance.now() - start) / 1000;
      const pos = geometry.attributes.position;
      const amp = fabric.drape === '流畅垂坠' ? 0.24 : 0.17;

      for (let i = 0; i < pos.count; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const wave1 = Math.sin(bx * 2.1 + elapsed * 1.1) * amp;
        const wave2 = Math.cos(by * 1.8 - elapsed * 0.85) * (amp * 0.55);
        pos.setZ(i, wave1 + wave2);
      }
      pos.needsUpdate = true;
      geometry.computeVertexNormals();

      clothMesh.rotation.x += (dragRef.current.rotX - clothMesh.rotation.x) * 0.08;
      clothMesh.rotation.y +=
        (dragRef.current.rotY + Math.sin(elapsed * 0.45) * 0.08 - clothMesh.rotation.y) * 0.08;

      renderer.render(threeScene, camera);
      rafId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 320;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      geometry.dispose();
      material.dispose();
      map.dispose();
      bumpMap.dispose();
      renderer.dispose();
    };
  }, [fabric, scene]);

  if (webglError) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 240,
          background: `radial-gradient(circle at 32% 30%, ${fabric.pbr.sheenColor}55, ${fabric.pbr.baseColor} 72%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: 13,
        }}
      >
        {fabric.name}
      </div>
    );
  }

  return (
    <div
      style={{ position: 'relative', flex: 1, minHeight: 240, background: '#18181b', cursor: 'grab' }}
      onPointerDown={(e) => {
        dragRef.current.active = true;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
      }}
      onPointerMove={(e) => {
        if (!dragRef.current.active) return;
        const dx = e.clientX - dragRef.current.lastX;
        const dy = e.clientY - dragRef.current.lastY;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        dragRef.current.rotY = Math.max(-0.85, Math.min(0.85, dragRef.current.rotY + dx * 0.008));
        dragRef.current.rotX = Math.max(-0.7, Math.min(0.45, dragRef.current.rotX + dy * 0.008));
      }}
      onPointerUp={() => {
        dragRef.current.active = false;
      }}
      onPointerLeave={() => {
        dragRef.current.active = false;
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 240 }} />
      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: 999,
          padding: '6px 12px',
          fontSize: 11.5,
          color: '#111111',
        }}
      >
        <span>{scene.lighting.colorTempLabel}</span>
        <span style={{ color: '#6e6e73' }}>拖拽观察织物光泽</span>
      </div>
    </div>
  );
}
