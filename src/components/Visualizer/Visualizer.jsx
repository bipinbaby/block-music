import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSequencerStore } from '../../store/sequencerStore';

// ─── Constants ──────────────────────────────────────────────────
const MIN_OCT  = 2;
const MAX_OCT  = 5;
const N_LEVELS = MAX_OCT - MIN_OCT + 1;   // 4

const BW    = 1.0;    // block width
const BH    = 0.52;   // block height
const BD    = 0.38;   // block depth
const GAP_H = 0.08;   // vertical gap between levels

const OCTAVE_HUES = { 2: 0, 3: 30, 4: 60, 5: 120 };

function hslToColor(h, s, l) {
  const c = new THREE.Color();
  c.setHSL(h / 360, s / 100, l / 100);
  return c;
}

function blockBaseColor(octave)     { return hslToColor(OCTAVE_HUES[octave] ?? 0, 90, 40); }
function blockEmissiveCol(octave)   { return hslToColor(OCTAVE_HUES[octave] ?? 0, 100, 60); }
function blockLightColor(octave)    { return hslToColor(OCTAVE_HUES[octave] ?? 0, 100, 75); }
function blockBrightColor(octave)   { return hslToColor(OCTAVE_HUES[octave] ?? 0, 90, 72); }

function computeRadius(cols) {
  return Math.max(3.5, (cols * (BW + 0.28)) / (2 * Math.PI));
}

// ─── Glow sprite texture (radial gradient on canvas) ───────────
function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const mid = size / 2;
  const grad = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  grad.addColorStop(0,    'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(0.6,  'rgba(255,255,255,0.15)');
  grad.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ─── React component ────────────────────────────────────────────
export default function Visualizer() {
  const mountRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) mountRef.current?.requestFullscreen();
    else document.exitFullscreen();
  }

  // ── Three.js lifecycle ───────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ── Scene ─────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07070f);
    scene.fog = new THREE.FogExp2(0x07070f, 0.042);

    // ── Camera ────────────────────────────────────────────────
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(52, cw / ch, 0.1, 200);
    camera.position.set(0, 2.8, 11);
    camera.lookAt(0, 0, 0);

    // ── Renderer ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(cw, ch);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // ── Lights ────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(6, 10, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(512, 512);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x9966ff, 0.5);
    rimLight.position.set(-6, 3, -8);
    scene.add(rimLight);

    // ── Carousel group ────────────────────────────────────────
    const carousel = new THREE.Group();
    carousel.rotation.x = -0.26; // tilt to reveal top faces
    scene.add(carousel);

    // ── Shared geometry ──────────────────────────────────────
    const blockGeo = new THREE.BoxGeometry(BW, BH, BD);

    // ── Glow sprite setup ────────────────────────────────────
    const glowTex = makeGlowTexture();

    // ─────────────────────────────────────────────────────────
    // meshMap[col][level] = {
    //   mesh, mat, glowSprite, pointLight,
    //   isFiller, octave,
    //   isFlash, flashStart, unflashStart
    // }
    // ─────────────────────────────────────────────────────────
    const meshMap = [];
    let numCols = useSequencerStore.getState().totalColumns;

    function buildCarousel(cols, blocks) {
      // Remove old objects
      while (carousel.children.length) {
        const child = carousel.children[0];
        if (child.geometry && child.geometry !== blockGeo) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
        carousel.remove(child);
      }
      meshMap.length = 0;
      numCols = cols;

      const radius = computeRadius(cols);

      for (let col = 0; col < cols; col++) {
        meshMap[col] = [];
        const angle = (col / cols) * Math.PI * 2;
        const sx = Math.sin(angle) * radius;
        const sz = Math.cos(angle) * radius;

        for (let lvl = 0; lvl < N_LEVELS; lvl++) {
          const octave = MIN_OCT + lvl;
          const match  = blocks.find(b =>
            b.column === col &&
            Math.max(MIN_OCT, Math.min(MAX_OCT, b.octave)) === octave
          );
          const isFiller = !match;

          // Block mesh material
          const mat = new THREE.MeshStandardMaterial({
            color:             isFiller ? new THREE.Color(0x12122a) : blockBaseColor(octave),
            emissive:          new THREE.Color(0x000000),
            emissiveIntensity: 0,
            metalness:         isFiller ? 0.1  : 0.2,
            roughness:         isFiller ? 0.9  : 0.5,
            transparent:       isFiller,
            opacity:           isFiller ? 0.22 : 1.0,
          });

          const mesh = new THREE.Mesh(blockGeo, mat);

          // y: lvl=0 (oct2, red) at top, lvl=3 (oct5, green) at bottom
          const y = ((N_LEVELS - 1 - lvl) - (N_LEVELS - 1) / 2) * (BH + GAP_H);
          mesh.position.set(sx, y, sz);
          mesh.lookAt(0, y, 0); // face the center
          mesh.castShadow    = !isFiller;
          mesh.receiveShadow = true;
          carousel.add(mesh);

          // ── Glow sprite (hidden until flash) ──────────────
          let glowSprite = null;
          let pointLight  = null;

          if (!isFiller) {
            // Sprite behind the block face
            const spriteMat = new THREE.SpriteMaterial({
              map:         glowTex,
              color:       blockLightColor(octave),
              transparent: true,
              opacity:     0,
              blending:    THREE.AdditiveBlending,
              depthWrite:  false,
            });
            glowSprite = new THREE.Sprite(spriteMat);
            glowSprite.scale.set(2.8, 2.8, 1);

            // Place the sprite at the same world position as the mesh
            // (carousel local coords, will move with it)
            glowSprite.position.copy(mesh.position);
            // Push sprite slightly toward center so it sits behind the face
            const toCenter = new THREE.Vector3(-sx, 0, -sz).normalize();
            glowSprite.position.addScaledVector(toCenter, 0.15);
            carousel.add(glowSprite);

            // Point light — colour the surrounding blocks
            pointLight = new THREE.PointLight(blockLightColor(octave), 0, 4.5, 2);
            pointLight.position.copy(mesh.position);
            carousel.add(pointLight);
          }

          meshMap[col].push({
            mesh, mat, glowSprite, pointLight,
            isFiller, octave,
            isFlash: false, flashStart: 0, unflashStart: 0,
          });
        }
      }
    }

    const init = useSequencerStore.getState();
    buildCarousel(init.totalColumns, init.blocks);

    // ── Rotation tracking ─────────────────────────────────────
    const rot = { current: 0, target: 0, playbackState: init.playbackState };

    // ── Store subscription ────────────────────────────────────
    const unsub = useSequencerStore.subscribe((state, prev) => {
      // Rebuild when blocks or column count change
      if (state.blocks !== prev.blocks || state.totalColumns !== prev.totalColumns) {
        buildCarousel(state.totalColumns, state.blocks);
      }

      // ── Flash in ──────────────────────────────────────────
      if (state.triggerSet !== prev.triggerSet) {
        state.triggerSet.forEach(id => {
          if (prev.triggerSet.has(id)) return;
          const block = state.blocks.find(b => b.id === id);
          if (!block) return;
          const col   = block.column;
          const level = Math.max(MIN_OCT, Math.min(MAX_OCT, block.octave)) - MIN_OCT;
          const entry = meshMap[col]?.[level];
          if (!entry || entry.isFiller) return;
          entry.isFlash   = true;
          entry.flashStart = performance.now();
        });

        // ── Flash out ────────────────────────────────────────
        prev.triggerSet.forEach(id => {
          if (state.triggerSet.has(id)) return;
          const block = state.blocks.find(b => b.id === id);
          if (!block) return;
          const col   = block.column;
          const level = Math.max(MIN_OCT, Math.min(MAX_OCT, block.octave)) - MIN_OCT;
          const entry = meshMap[col]?.[level];
          if (!entry || entry.isFiller) return;
          entry.isFlash      = false;
          entry.unflashStart = performance.now();
        });
      }

      // ── Rotation target ──────────────────────────────────
      rot.playbackState = state.playbackState;

      if (state.playbackState === 'playing' && state.currentStep !== prev.currentStep) {
        const stepAngle = -(state.currentStep / state.totalColumns) * Math.PI * 2;
        let delta = stepAngle - rot.target;
        while (delta >  Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        rot.target = rot.target + delta;
      } else if (state.playbackState === 'stopped') {
        // Snap back to step 0 facing front
        let delta = 0 - rot.target;
        while (delta >  Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        rot.target = rot.target + delta;
      }
      // paused → leave target unchanged
    });

    // ── Floor atmosphere plane ────────────────────────────────
    const floorGeo = new THREE.PlaneGeometry(22, 22);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0x4422aa, transparent: true, opacity: 0.06, side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -(N_LEVELS * (BH + GAP_H)) / 2 - 0.5;
    scene.add(floor);

    // ── Animation loop ────────────────────────────────────────
    let rafId;
    let lastT = performance.now();

    function animate() {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt  = Math.min((now - lastT) / 1000, 0.1);
      lastT = now;

      // Lerp carousel Y rotation
      const lerpSpeed = rot.playbackState === 'playing' ? 9 : 3.5;
      rot.current += (rot.target - rot.current) * Math.min(1, lerpSpeed * dt);
      carousel.rotation.y = rot.current;

      // Update flash emissive + glow per entry
      for (let col = 0; col < meshMap.length; col++) {
        const col_ = meshMap[col];
        if (!col_) continue;
        for (let lvl = 0; lvl < col_.length; lvl++) {
          const e = col_[lvl];
          if (e.isFiller) continue;

          const { mat, glowSprite, pointLight, octave, isFlash, flashStart, unflashStart } = e;

          let intensity; // 0–1

          if (isFlash) {
            // Fast ramp-in: 35ms
            const t = Math.min(1, (now - flashStart) / 35);
            intensity = t;
          } else {
            // Exponential fade-out: ~280ms half-life
            const elapsed = (now - unflashStart) / 1000;
            intensity = Math.max(0, 1 - elapsed / 0.28);
          }

          // Emissive color + intensity on mesh material
          if (intensity > 0.01) {
            mat.emissive.copy(blockEmissiveCol(octave));
            mat.emissiveIntensity = intensity * 1.8;  // overshoot slightly for brightness
            mat.color.copy(blockBrightColor(octave));
          } else {
            mat.emissiveIntensity = 0;
            mat.color.copy(blockBaseColor(octave));
          }

          // Glow sprite opacity
          if (glowSprite) {
            glowSprite.material.opacity = intensity * 0.85;
            glowSprite.scale.setScalar(2.4 + intensity * 1.4);
          }

          // Point light intensity (radius 4.5 units affects nearby blocks)
          if (pointLight) {
            pointLight.intensity = intensity * 3.5;
          }
        }
      }

      renderer.render(scene, camera);
    }

    animate();

    // ── ResizeObserver ────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    ro.observe(container);

    // ── Cleanup ───────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      unsub();
      ro.disconnect();
      glowTex.dispose();
      blockGeo.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#07070f' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Fullscreen button */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 8, color: 'rgba(255,255,255,0.55)',
          width: 34, height: 34, cursor: 'pointer', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {isFullscreen ? '✕' : '⛶'}
      </button>

      <StepLabel />
    </div>
  );
}

function StepLabel() {
  const playbackState = useSequencerStore(s => s.playbackState);
  const currentStep   = useSequencerStore(s => s.currentStep);
  const totalColumns  = useSequencerStore(s => s.totalColumns);

  return (
    <div style={{
      position: 'absolute', top: 14, left: 0, right: 0,
      textAlign: 'center', pointerEvents: 'none',
      fontSize: 11, fontWeight: 700,
      color: 'rgba(255,255,255,0.15)',
      letterSpacing: '0.2em', textTransform: 'uppercase',
    }}>
      {playbackState === 'playing'
        ? `${currentStep + 1} / ${totalColumns}`
        : playbackState === 'paused' ? 'PAUSED' : ''}
    </div>
  );
}
