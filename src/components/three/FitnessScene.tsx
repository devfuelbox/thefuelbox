'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { createFitnessKit, type Equipment, type Rig, type Workout } from './fitness/rig';

/**
 * FuelBox workout-cast backdrop.
 *
 * A small, original cast of cartoon men & women exercising in the background —
 * lifting dumbbells, squatting, running on a treadmill, cycling and stretching.
 * The idea is inspired by the shape of a Gym Visual style exercise library
 * (clean, friendly, exercise-forward characters) but every model here is built
 * procedurally from Three.js primitives, so there are no third-party assets to
 * license.
 *
 * Placement is the important part: the cast is anchored in the *side gutters*
 * beside the centred onboarding copy, so it never sits on top of the form,
 * buttons or text. On phones (no gutters) it falls back to a large, centred
 * workout pair behind the hero, only while the hero is on screen.
 *
 * Performance / safety:
 *   • next/dynamic({ ssr:false }) keeps three.js off the server + critical path.
 *   • WebGL is feature-detected; no WebGL → lightweight SVG fallback.
 *   • The loop pauses when the tab is hidden or the canvas is off-screen.
 *   • devicePixelRatio is capped and the number of characters scales with the
 *     available gutter, so phones render far less than desktops.
 *   • prefers-reduced-motion paints a single still frame.
 *   • Pointer position nudges the scene + heads, for a light interactive feel.
 *   • Every geometry, material, texture, renderer and listener is disposed.
 */

const GREEN_LIGHT = 0x22c55e;
const ENERGY = 0xf97316;

interface CastMember {
  workout: Workout;
  /** base yaw, in radians, before the gutter tilt is added */
  base: number;
  /** extra lift so feet don't clip their equipment */
  lift?: number;
  character: Parameters<ReturnType<typeof createFitnessKit>['createCharacter']>[0];
}

// Cast order also drives the layout: L, R, L, R …
const CAST: CastMember[] = [
  {
    workout: 'curl',
    base: 0.15,
    character: {
      gender: 'male',
      skin: 0xe3ad84,
      hair: 0x2f2417,
      hairStyle: 'short',
      top: 0x16a34a,
      bottom: 0x22302a,
      shoe: 0xf3eddf,
      accent: 0xf97316,
    },
  },
  {
    workout: 'squat',
    base: 0.5,
    character: {
      gender: 'female',
      skin: 0xd79b72,
      hair: 0x1f2937,
      hairStyle: 'ponytail',
      top: 0xef7a3d,
      bottom: 0x1f3d2b,
      shoe: 0xffffff,
      accent: 0x22c55e,
    },
  },
  {
    workout: 'run',
    base: -0.7,
    lift: 0.05,
    character: {
      gender: 'female',
      skin: 0xd79b72,
      hair: 0x4a2c1a,
      hairStyle: 'long',
      top: 0x22c55e,
      bottom: 0x2b3a33,
      shoe: 0xf3eddf,
      accent: 0xf97316,
    },
  },
  {
    workout: 'cycle',
    base: -0.55,
    character: {
      gender: 'male',
      skin: 0xc98b62,
      hair: 0x101418,
      hairStyle: 'short',
      top: 0x1f3d2b,
      bottom: 0x16a34a,
      shoe: 0xf3eddf,
      accent: 0x22c55e,
    },
  },
  {
    workout: 'stretch',
    base: 0.1,
    character: {
      gender: 'female',
      skin: 0xe3ad84,
      hair: 0x6b2f1e,
      hairStyle: 'bun',
      top: 0xef7a3d,
      bottom: 0x34413a,
      shoe: 0xffffff,
      accent: 0x16a34a,
    },
  },
];

// ── Static SVG fallback for devices without WebGL ─────────────────────────
function StaticFallback({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.16,
        ...style,
      }}
    >
      <svg viewBox="0 0 420 260" width="min(90vw, 560px)" fill="none">
        {/* left figure — lifting */}
        <g stroke="#1F3D2B" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="120" cy="66" r="17" fill="#1F3D2B" />
          <path d="M120 88 V150" />
          <path d="M120 106 L92 92 M120 106 L148 92" />
          <path d="M120 150 L104 198 M120 150 L136 198" />
          <path d="M74 92 H166" />
        </g>
        {/* right figure — stretching */}
        <g stroke="#16A34A" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="300" cy="60" r="17" fill="#16A34A" />
          <path d="M300 82 V148" />
          <path d="M300 96 L268 60 M300 96 L332 60" />
          <path d="M300 148 L282 196 M300 148 L318 196" />
        </g>
      </svg>
    </div>
  );
}

function webglSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

interface Station {
  group: import('three').Group;
  rig: Rig;
  workout: Workout;
  equipment?: Equipment;
  /** slot index used for the staggered entrance */
  order: number;
  /** original authored yaw from the CAST definition */
  baseRot0: number;
  /** computed yaw (baseRot0 + gutter tilt) */
  baseRotY: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  baseScale: number;
}

export default function FitnessScene({
  className,
  style,
  opacity = 0.4,
  safeWidth = 560,
  mobileCast = true,
}: {
  className?: string;
  style?: React.CSSProperties;
  opacity?: number;
  /** width, in CSS px, of the centred copy that must stay clear */
  safeWidth?: number;
  /** whether the cast is allowed on very narrow screens */
  mobileCast?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  // True when there are no usable side gutters (phones / portrait), so the cast
  // falls back to the centred phone composition — which we render a little
  // larger and more opaque so it still reads as a focal point.
  const [narrow, setNarrow] = useState(false);

  // Layout inputs are read through refs so changing them (e.g. when the user
  // moves between onboarding steps) re-lays-out the cast without tearing down
  // and rebuilding the whole WebGL scene.
  const safeWidthRef = useRef(safeWidth);
  const mobileCastRef = useRef(mobileCast);
  safeWidthRef.current = safeWidth;
  mobileCastRef.current = mobileCast;
  const layoutRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSupported(webglSupported());
  }, []);

  // Re-place the cast when the "must stay clear" width or the phone rule change.
  useEffect(() => {
    layoutRef.current?.();
  }, [safeWidth, mobileCast]);

  useEffect(() => {
    if (supported !== true) return;
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    let renderer: import('three').WebGLRenderer | null = null;
    let cleanupFns: Array<() => void> = [];

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    (async () => {
      let THREE: typeof import('three');
      try {
        THREE = await import('three');
      } catch {
        setSupported(false);
        return;
      }
      if (disposed || !host) return;

      const kit = createFitnessKit(THREE);

      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;

      // ── Renderer ──
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: window.devicePixelRatio < 2,
          powerPreference: 'high-performance',
        });
      } catch {
        setSupported(false);
        return;
      }
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const small = window.innerWidth < 768;
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 120);
      camera.position.set(0, 1.2, 7.5);
      camera.lookAt(0, 1.2, 0);

      // ── Lighting: soft, cartoon-friendly, brand tinted ──
      scene.add(new THREE.HemisphereLight(0xe9f6ec, 0xf3eddf, 0.85));
      scene.add(new THREE.AmbientLight(0xffffff, 0.35));
      const key = new THREE.DirectionalLight(0xffffff, 1.15);
      key.position.set(5, 8, 7);
      scene.add(key);
      const fill = new THREE.PointLight(GREEN_LIGHT, 1.5, 30);
      fill.position.set(-7, 3, 5);
      scene.add(fill);
      const warm = new THREE.PointLight(ENERGY, 1.1, 28);
      warm.position.set(7, 1.5, 4);
      scene.add(warm);

      // Everything lives under `stage` so a pointer can gently rotate it.
      const stage = new THREE.Group();
      scene.add(stage);

      const stations: Station[] = [];

      CAST.forEach((member, i) => {
        const group = new THREE.Group();
        const rig = kit.createCharacter(member.character);
        group.add(rig.root);
        group.add(kit.shadow(0.95));

        let equipment: Equipment | undefined;
        if (member.workout === 'curl') {
          const d = kit.createDumbbells();
          d.left.position.set(0, -0.02, 0);
          d.right.position.set(0, -0.02, 0);
          rig.wristL.add(d.left);
          rig.wristR.add(d.right);
        } else if (member.workout === 'squat') {
          // bodyweight squat — no equipment, arms reach forward for balance
        } else if (member.workout === 'run') {
          const t = kit.createTreadmill();
          equipment = t;
          // drop the deck so the runner's swinging feet never clip through it
          t.group.position.y = -(member.lift ?? 0);
          group.add(t.group);
        } else if (member.workout === 'cycle') {
          const b = kit.createBike();
          equipment = b;
          group.add(b.group);
        } else {
          const m = kit.createMat();
          equipment = m;
          group.add(m.group);
        }

        stage.add(group);
        stations.push({
          group,
          rig,
          workout: member.workout,
          equipment,
          order: i,
          baseRot0: member.base,
          baseRotY: member.base,
          baseX: 0,
          baseY: 0,
          baseZ: 0,
          baseScale: 1,
        });
      });

      // ── Ambient nutrient / energy motes ──
      const particleCount = small ? 55 : 110;
      const pGeom = new THREE.BufferGeometry();
      const pPos = new Float32Array(particleCount * 3);
      const pSeed = new Float32Array(particleCount);
      for (let i = 0; i < particleCount; i += 1) {
        pPos[i * 3] = (Math.random() - 0.5) * 9;
        pPos[i * 3 + 1] = Math.random() * 5;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 3 - 1;
        pSeed[i] = Math.random();
      }
      pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const pMat = new THREE.PointsMaterial({
        color: GREEN_LIGHT,
        size: small ? 0.05 : 0.045,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(pGeom, pMat);
      stage.add(points);

      // ── Layout: park the cast in the gutters, or low on phones ──
      const layout = () => {
        const vw = host.clientWidth || 1;
        const vh = host.clientHeight || 1;
        camera.aspect = vw / vh;
        camera.updateProjectionMatrix();

        const aspect = vw / vh;
        const halfH = Math.tan(((camera.fov * Math.PI) / 180) / 2) * camera.position.z;
        const halfW = halfH * aspect;
        const safeHalf = ((safeWidthRef.current / 2) / (vw / 2)) * halfW;
        const gutterW = halfW - safeHalf;

        // Work out how many figures each gutter can hold without the outermost
        // one being clamped back on top of its neighbour, then grow them as
        // large as that count allows. `fit` mirrors the placement maths below.
        const halfCharFor = (s: number) => 0.46 * s;
        const fit = (n: number, s: number) => n * 2 * halfCharFor(s) + (n - 1) * 0.26 + 0.18;

        let perSide = 0;
        let scale = 0.72;
        for (const n of [3, 2, 1]) {
          if (fit(n, 0.72) <= gutterW) {
            perSide = n;
            break;
          }
        }
        if (perSide > 0) {
          for (const s of [1, 0.9, 0.82, 0.72]) {
            if (fit(perSide, s) <= gutterW) {
              scale = s;
              break;
            }
          }
        }

        const narrow = perSide === 0;
        setNarrow(narrow);

        if (narrow) {
          // phone / portrait: a large, clearly-visible workout pair centred in
          // the viewport. The size is driven by height (so it reads as the
          // focal point) and then clamped by width (so the two figures never
          // collide or spill off the sides).
          const show = mobileCastRef.current ? Math.min(2, stations.length) : 0;
          const gap = Math.min(0.22, halfW * 0.09);
          const byHeight = 1.2; // ≈ 45% of the visible world height
          const byWidth = (halfW - gap - 0.03) / (2 * 0.46);
          const scaleF = Math.max(0.55, Math.min(byHeight, byWidth));
          // Lift the pair so the *visual* centre (the two figures have quite
          // different standing heights) lands on the camera's centre line.
          const lift = 0.84 * scaleF;
          const halfCharF = 0.46 * scaleF;
          const spread = show > 1 ? halfCharF + gap : 0;
          stations.forEach((st, i) => {
            const dir = i === 0 ? -1 : 1;
            st.baseX = dir * spread;
            st.baseY = camera.position.y - lift;
            st.baseZ = -0.5;
            st.baseRotY = st.baseRot0 + dir * 0.22;
            st.baseScale = scaleF;
            st.group.visible = i < show;
          });
          return;
        }

        const halfChar = halfCharFor(scale);
        const spacing = 2 * halfChar + 0.26;
        const inner = safeHalf + halfChar + 0.12;

        const slots: Array<{ side: number; k: number }> = [];
        for (let k = 0; k < perSide; k += 1) slots.push({ side: -1, k });
        for (let k = 0; k < perSide; k += 1) slots.push({ side: 1, k });

        stations.forEach((st, i) => {
          if (i >= slots.length) {
            st.group.visible = false;
            return;
          }
          const { side, k } = slots[i];
          const x = Math.min(inner + k * spacing, halfW - halfChar - 0.06);
          st.baseX = side * x;
          st.baseY = 0;
          st.baseZ = -k * 0.45 + (i % 2) * 0.12;
          st.baseRotY = st.baseRot0 + side * 0.34;
          st.baseScale = scale * (1 - k * 0.05);
          st.group.visible = true;
        });
      };
      layout();
      layoutRef.current = layout;

      // ── Pointer interactivity (parallax + head turn) ──
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      const onPointer = (e: PointerEvent) => {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener('pointermove', onPointer, { passive: true });
      cleanupFns.push(() => window.removeEventListener('pointermove', onPointer));

      // ── Animation ──
      let elapsed = 0;
      let last = performance.now();
      const now = () => performance.now();

      const renderFrame = (dt: number) => {
        elapsed += dt;
        const t = elapsed;

        // eased pointer
        const k = Math.min(1, dt * 3);
        pointer.x += (pointer.tx - pointer.x) * k;
        pointer.y += (pointer.ty - pointer.y) * k;
        stage.rotation.y = pointer.x * 0.08;
        stage.rotation.x = pointer.y * 0.03;

        for (let i = 0; i < stations.length; i += 1) {
          const st = stations[i];
          if (!st.group.visible) continue;

          const p = reduce
            ? 1
            : Math.min(1, Math.max(0, (t - 0.15 - st.order * 0.11) / 0.7));
          const e = p * p * (3 - 2 * p);

          st.group.position.set(st.baseX, st.baseY - (1 - e) * 0.3, st.baseZ);
          st.group.rotation.y = st.baseRotY;
          st.group.scale.setScalar(st.baseScale * (0.72 + 0.28 * e));

          kit.animate(st.rig, st.workout, t, dt);
          st.rig.head.rotation.y += pointer.x * 0.28;
          if (st.equipment?.update) st.equipment.update(t, dt);
        }

        // motes rise and wrap
        const pos = pGeom.getAttribute('position') as import('three').BufferAttribute;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < particleCount; i += 1) {
          const yi = i * 3 + 1;
          arr[yi] += dt * (0.24 + pSeed[i] * 0.4);
          if (arr[yi] > 5) {
            arr[yi] = 0;
            arr[i * 3] = (Math.random() - 0.5) * 9;
          }
        }
        pos.needsUpdate = true;

        renderer!.render(scene, camera);
      };

      const resize = () => {
        if (!renderer || !host) return;
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        layout();
      };
      window.addEventListener('resize', resize);
      cleanupFns.push(() => window.removeEventListener('resize', resize));

      if (reduce) {
        elapsed = 1.2;
        renderFrame(0);
      } else {
        let visible = true;
        const io = new IntersectionObserver(
          (entries) => {
            const next = entries[0]?.isIntersecting ?? true;
            visible = next;
            if (next) {
              last = now();
              if (!raf) loop();
            } else if (raf) {
              cancelAnimationFrame(raf);
              raf = 0;
            }
          },
          { threshold: 0 },
        );
        io.observe(host);
        cleanupFns.push(() => io.disconnect());

        const onVisibility = () => {
          if (document.hidden) {
            if (raf) {
              cancelAnimationFrame(raf);
              raf = 0;
            }
          } else if (visible && !raf) {
            last = now();
            loop();
          }
        };
        document.addEventListener('visibilitychange', onVisibility);
        cleanupFns.push(() => document.removeEventListener('visibilitychange', onVisibility));

        function loop() {
          raf = requestAnimationFrame(() => {
            if (!visible || document.hidden) {
              raf = 0;
              return;
            }
            const ts = now();
            const delta = Math.min((ts - last) / 1000, 0.05);
            last = ts;
            renderFrame(delta);
            loop();
          });
        }
        loop();
      }

      cleanupFns.push(() => {
        cancelAnimationFrame(raf);
        raf = 0;
        kit.dispose();
        renderer?.dispose();
        if (renderer?.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        renderer = null;
      });
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      layoutRef.current = null;
      for (const fn of cleanupFns) {
        try {
          fn();
        } catch {
          /* noop */
        }
      }
      cleanupFns = [];
    };
  }, [supported]);

  if (supported === false) {
    return <StaticFallback className={className} style={{ opacity, ...style }} />;
  }

  // Phones have no gutter to lean the cast against, so the centred composition
  // gets a visibility bump to keep it present behind the hero copy.
  const shownOpacity = narrow ? Math.max(opacity, 0.6) : opacity;

  return (
    <motion.div
      ref={hostRef}
      aria-hidden="true"
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: shownOpacity }}
      transition={{ duration: 1.1, ease: [0.16, 0.8, 0.2, 1] }}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
