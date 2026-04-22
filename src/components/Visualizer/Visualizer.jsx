import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSequencerStore } from '../../store/sequencerStore';

// ─── Constants ──────────────────────────────────────────────────
const MIN_OCT  = 2;
const MAX_OCT  = 5;
const N_LEVELS = MAX_OCT - MIN_OCT + 1;   // 4

const BW    = 1.0;
const BH    = 0.52;
const BD    = 0.38;
const GAP_H = 0.08;

const OCTAVE_HUES = { 2: 0, 3: 30, 4: 60, 5: 120 };

function hslToColor(h, s, l) {
  const c = new THREE.Color();
  c.setHSL(h / 360, s / 100, l / 100);
  return c;
}

function blockBaseColor(octave) { return hslToColor(OCTAVE_HUES[octave] ?? 0, 90, 40); }

function computeRadius(cols) {
  return Math.max(3.5, (cols * (BW + 0.28)) / (2 * Math.PI));
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
    carousel.rotation.x = -0.26;
    scene.add(carousel);

    // ── Shared geometry ───────────────────────────────────────
    const blockGeo = new THREE.BoxGeometry(BW, BH, BD);

    // meshMap[col][level] = { mesh, mat, isFiller, octave }
    const meshMap = [];

    function buildCarousel(cols, blocks) {
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

          const mat = new THREE.MeshStandardMaterial({
            color:       isFiller ? new THREE.Color(0x12122a) : blockBaseColor(octave),
            metalness:   isFiller ? 0.1 : 0.2,
            roughness:   isFiller ? 0.9 : 0.5,
            transparent: isFiller,
            opacity:     isFiller ? 0.22 : 1.0,
          });

          const mesh = new THREE.Mesh(blockGeo, mat);
          const y = ((N_LEVELS - 1 - lvl) - (N_LEVELS - 1) / 2) * (BH + GAP_H);
          mesh.position.set(sx, y, sz);
          mesh.lookAt(0, y, 0);
          mesh.castShadow    = !isFiller;
          mesh.receiveShadow = true;
          carousel.add(mesh);

          meshMap[col].push({ mesh, mat, isFiller, octave });
        }
      }
    }

    const init = useSequencerStore.getState();
    buildCarousel(init.totalColumns, init.blocks);

    // ── Rotation tracking ─────────────────────────────────────
    const rot = { current: 0, target: 0, playbackState: init.playbackState };

    // ── Store subscription ────────────────────────────────────
    const unsub = useSequencerStore.subscribe((state, prev) => {
      if (state.blocks !== prev.blocks || state.totalColumns !== prev.totalColumns) {
        buildCarousel(state.totalColumns, state.blocks);
      }

      rot.playbackState = state.playbackState;

      if (state.playbackState === 'playing' && state.currentStep !== prev.currentStep) {
        const stepAngle = -(state.currentStep / state.totalColumns) * Math.PI * 2;
        let delta = stepAngle - rot.target;
        while (delta >  Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        rot.target = rot.target + delta;
      } else if (state.playbackState === 'stopped') {
        let delta = 0 - rot.target;
        while (delta >  Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        rot.target = rot.target + delta;
      }
    });

    // ── Floor atmosphere ──────────────────────────────────────
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

      const lerpSpeed = rot.playbackState === 'playing' ? 9 : 3.5;
      rot.current += (rot.target - rot.current) * Math.min(1, lerpSpeed * dt);
      carousel.rotation.y = rot.current;

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
