import type * as Three from 'three';

type T = typeof Three;

/**
 * Procedural, licence-free cartoon fitness cast for FuelBox.
 *
 * Everything here is built from Three.js primitives — no external models,
 * textures or bought assets — so it is safe to ship and easy to tune. The
 * look is intentionally "modern 3D cartoon": rounded capsules, soft studio
 * lighting, a friendly face and the FuelBox forest/green/orange palette.
 *
 * The exercises are inspired by the general idea of a Gym Visual style
 * exercise library (lifting, running, squats, cycling, stretching) but the
 * characters, proportions and rig are entirely original.
 */

export type Workout = 'curl' | 'squat' | 'run' | 'cycle' | 'stretch';

export interface CharacterConfig {
  gender: 'male' | 'female';
  skin: number;
  hair: number;
  hairStyle: 'short' | 'bun' | 'ponytail' | 'long';
  top: number;
  bottom: number;
  shoe: number;
  accent: number;
}

export interface Limb {
  pivot: Three.Group;
  joint: Three.Group;
}

export interface Rig {
  root: Three.Group;
  pelvis: Three.Group;
  torso: Three.Group;
  head: Three.Group;
  shoulderL: Three.Group;
  shoulderR: Three.Group;
  elbowL: Three.Group;
  elbowR: Three.Group;
  wristL: Three.Object3D;
  wristR: Three.Object3D;
  hipL: Three.Group;
  hipR: Three.Group;
  kneeL: Three.Group;
  kneeR: Three.Group;
  ankleL: Three.Object3D;
  ankleR: Three.Object3D;
  baseHipY: number;
  /** small accessory that can bob with the exercise (ponytail, towel, …) */
  sway: Three.Object3D[];
}

export interface Equipment {
  group: Three.Group;
  update?: (t: number, dt: number) => void;
}

const HIP_Y = 0.95;

// ─────────────────────────────────────────────────────────────────────────
//  Everything below is created against a live THREE instance so the module
//  itself stays tree-shakeable and never touches the library at import time.
// ─────────────────────────────────────────────────────────────────────────
export function createFitnessKit(THREE: T) {
  // ── Shared, de-duplicated geometry & material registries ───────────────
  const geoms: Three.BufferGeometry[] = [];
  const mats: Three.Material[] = [];
  const textures: Three.Texture[] = [];
  const gCache = new Map<string, Three.BufferGeometry>();
  const mCache = new Map<string, Three.MeshStandardMaterial>();
  const bCache = new Map<string, Three.MeshBasicMaterial>();

  const geom = <G extends Three.BufferGeometry>(key: string, make: () => G): G => {
    let g = gCache.get(key) as G | undefined;
    if (!g) {
      g = make();
      gCache.set(key, g);
      geoms.push(g);
    }
    return g;
  };
  const mat = (color: number, rough = 0.6, metal = 0.03): Three.MeshStandardMaterial => {
    const key = `${color}|${rough}|${metal}`;
    let m = mCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
      mCache.set(key, m);
      mats.push(m);
    }
    return m;
  };
  const basic = (color: number, opacity = 1, transparent = opacity < 1): Three.MeshBasicMaterial => {
    const key = `${color}|${opacity}|${transparent}`;
    let m = bCache.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({
        color,
        transparent,
        opacity,
        depthWrite: !transparent,
      });
      bCache.set(key, m);
      mats.push(m);
    }
    return m;
  };

  // ── Primitive caches ──────────────────────────────────────────────────
  const capsule = (r: number, l: number, cs = 6, rs = 14) =>
    geom(`cap|${r}|${l}`, () => new THREE.CapsuleGeometry(r, Math.max(0.01, l), cs, rs));
  const ball = (r: number, ws = 16, hs = 16) =>
    geom(`sph|${r}`, () => new THREE.SphereGeometry(r, ws, hs));
  const box = (w: number, h: number, d: number) =>
    geom(`box|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
  const cyl = (r: number, h: number, seg = 16) =>
    geom(`cyl|${r}|${h}`, () => new THREE.CylinderGeometry(r, r, h, seg));
  const torus = (r: number, t: number, arc = Math.PI * 2) =>
    geom(`tor|${r}|${t}|${arc}`, () => new THREE.TorusGeometry(r, t, 8, 24, arc));

  const mesh = (g: Three.BufferGeometry, m: Three.Material) => new THREE.Mesh(g, m);

  /** A bone that hangs below its pivot; returns the pivot and a child joint. */
  const bone = (parent: Three.Object3D, r: number, len: number, m: Three.Material): Limb => {
    const pivot = new THREE.Group();
    parent.add(pivot);
    const m0 = mesh(capsule(r, len - 2 * r), m);
    m0.position.y = -len / 2;
    pivot.add(m0);
    const joint = new THREE.Group();
    joint.position.y = -len;
    pivot.add(joint);
    return { pivot, joint };
  };

  // ── Soft contact shadow sprite ────────────────────────────────────────
  let shadowTex: Three.Texture | null = null;
  const getShadowTex = () => {
    if (shadowTex) return shadowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      const grd = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
      grd.addColorStop(0, 'rgba(22,38,28,0.55)');
      grd.addColorStop(0.55, 'rgba(22,38,28,0.22)');
      grd.addColorStop(1, 'rgba(22,38,28,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 128, 128);
    }
    shadowTex = new THREE.CanvasTexture(c);
    textures.push(shadowTex);
    return shadowTex;
  };
  const plane = geom('plane|1', () => new THREE.PlaneGeometry(1, 1));
  const shadow = (size: number) => {
    const m = mesh(plane, basic(0xffffff, 1, true));
    (m.material as Three.MeshBasicMaterial).map = getShadowTex();
    m.rotation.x = -Math.PI / 2;
    m.scale.set(size, size * 0.62, 1);
    m.position.y = 0.012;
    m.renderOrder = -1;
    return m;
  };

  // ───────────────────────────────────────────────────────────────────────
  //  Character
  // ───────────────────────────────────────────────────────────────────────
  const createCharacter = (cfg: CharacterConfig): Rig => {
    const female = cfg.gender === 'female';
    const skinM = mat(cfg.skin, 0.62, 0.02);
    const topM = mat(cfg.top, 0.68, 0.02);
    const bottomM = mat(cfg.bottom, 0.68, 0.02);
    const shoeM = mat(cfg.shoe, 0.55, 0.06);
    const hairM = mat(cfg.hair, 0.72, 0.02);
    const accentM = mat(cfg.accent, 0.62, 0.05);
    const eyeM = mat(0x27303a, 0.35, 0.02);
    const whiteM = mat(0xffffff, 0.4, 0.0);

    const shoulderX = female ? 0.2 : 0.245;
    const hipX = female ? 0.135 : 0.128;

    const root = new THREE.Group();
    const sway: Three.Object3D[] = [];

    // pelvis ───────────────────────────────────────────────────────────
    const pelvis = new THREE.Group();
    pelvis.position.y = HIP_Y;
    root.add(pelvis);
    const pelvisMesh = mesh(ball(0.17), bottomM);
    pelvisMesh.scale.set(female ? 1.34 : 1.22, 0.86, 1.04);
    pelvis.add(pelvisMesh);

    // torso ────────────────────────────────────────────────────────────
    const torso = new THREE.Group();
    torso.position.y = 0.1;
    pelvis.add(torso);

    const waist = mesh(capsule(female ? 0.115 : 0.13, 0.1), female ? skinTop(topM, skinM) : topM);
    waist.position.y = 0.04;
    waist.scale.set(female ? 0.95 : 1.06, 1, 0.82);
    torso.add(waist);

    const chest = mesh(ball(0.2), topM);
    chest.scale.set(female ? 1.06 : 1.26, 1.02, 0.94);
    chest.position.y = 0.28;
    torso.add(chest);

    // small FuelBox-style chest tag
    const tag = mesh(box(0.01, 0.05, 0.02), accentM);
    tag.position.set(female ? 0.09 : 0.13, 0.3, 0.19);
    torso.add(tag);

    // arms ─────────────────────────────────────────────────────────────
    const armMat = skinM;
    const buildArm = (side: number, sleeveM: Three.Material) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * shoulderX, 0.4, 0);
      torso.add(shoulder);
      const sleeve = mesh(ball(0.088), sleeveM);
      shoulder.add(sleeve);
      const up = bone(shoulder, 0.072, 0.28, armMat);
      const fore = bone(up.joint, 0.06, 0.26, armMat);
      const hand = mesh(ball(0.072), armMat);
      fore.joint.add(hand);
      // wristband accent
      const band = mesh(cyl(0.062, 0.035), accentM);
      band.position.y = 0.02;
      fore.pivot.add(band);
      return { shoulder, elbow: up.joint, wrist: fore.joint };
    };
    const left = buildArm(-1, topM);
    const right = buildArm(1, topM);

    // head ─────────────────────────────────────────────────────────────
    const neck = mesh(capsule(0.055, 0.05), skinM);
    neck.position.y = 0.47;
    torso.add(neck);

    const head = new THREE.Group();
    head.position.y = 0.56;
    torso.add(head);

    const skull = mesh(ball(0.195, 22, 22), skinM);
    skull.scale.set(1, 1.08, 0.98);
    head.add(skull);

    // face
    for (const sx of [-1, 1]) {
      const eye = mesh(ball(0.042), whiteM);
      eye.position.set(sx * 0.072, 0.02, 0.155);
      eye.scale.set(1, 1.18, 0.55);
      head.add(eye);
      const pupil = mesh(ball(0.021), eyeM);
      pupil.position.set(sx * 0.074, 0.02, 0.185);
      head.add(pupil);
      const brow = mesh(box(0.06, 0.016, 0.02), hairM);
      brow.position.set(sx * 0.075, 0.1, 0.168);
      brow.rotation.z = sx * -0.12;
      head.add(brow);
    }
    const mouth = mesh(torus(0.052, 0.011, Math.PI), eyeM);
    mouth.position.set(0, -0.052, 0.168);
    mouth.rotation.z = Math.PI;
    head.add(mouth);

    // hair
    const cap = mesh(ball(0.2, 20, 20), hairM);
    cap.scale.set(1.02, 0.92, 1.02);
    cap.position.y = 0.035;
    head.add(cap);
    if (cfg.hairStyle === 'short') {
      const fringe = mesh(box(0.3, 0.09, 0.1), hairM);
      fringe.position.set(0, 0.115, 0.15);
      fringe.rotation.x = 0.2;
      head.add(fringe);
    } else if (cfg.hairStyle === 'bun') {
      const bun = mesh(ball(0.1), hairM);
      bun.position.set(0, 0.14, -0.2);
      head.add(bun);
    } else if (cfg.hairStyle === 'ponytail') {
      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0.06, -0.2);
      head.add(tailPivot);
      const tail = mesh(capsule(0.07, 0.24), hairM);
      tail.position.y = -0.16;
      tail.rotation.x = -0.25;
      tailPivot.add(tail);
      tailPivot.userData.base = 0;
      sway.push(tailPivot);
    } else {
      const longTail = mesh(capsule(0.09, 0.3), hairM);
      longTail.position.set(0, -0.12, -0.14);
      longTail.rotation.x = -0.1;
      longTail.scale.set(0.9, 1, 0.7);
      head.add(longTail);
      longTail.userData.base = -0.1;
      sway.push(longTail);
    }
    // headband accent
    if (cfg.accent) {
      const band = mesh(cyl(0.2, 0.03), accentM);
      band.position.y = 0.06;
      band.scale.set(1.02, 1, 1.02);
      head.add(band);
    }

    // legs ─────────────────────────────────────────────────────────────
    const buildLeg = (side: number) => {
      const hip = new THREE.Group();
      hip.position.set(side * hipX, 0, 0);
      pelvis.add(hip);
      const thigh = bone(hip, female ? 0.1 : 0.11, 0.45, bottomM);
      const shin = bone(thigh.joint, 0.082, 0.42, female ? bottomM : skinM);
      // sock
      const sock = mesh(cyl(0.085, 0.06), accentM);
      sock.position.y = -0.34;
      shin.pivot.add(sock);
      // shoe
      const shoe = mesh(capsule(0.078, 0.11), shoeM);
      shoe.rotation.x = Math.PI / 2;
      shoe.position.set(0, -0.03, 0.055);
      shin.joint.add(shoe);
      return { hip, knee: thigh.joint, ankle: shin.joint };
    };
    const legL = buildLeg(-1);
    const legR = buildLeg(1);

    return {
      root,
      pelvis,
      torso,
      head,
      shoulderL: left.shoulder,
      shoulderR: right.shoulder,
      elbowL: left.elbow,
      elbowR: right.elbow,
      wristL: left.wrist,
      wristR: right.wrist,
      hipL: legL.hip,
      hipR: legR.hip,
      kneeL: legL.knee,
      kneeR: legR.knee,
      ankleL: legL.ankle,
      ankleR: legR.ankle,
      baseHipY: HIP_Y,
      sway,
    };
  };

  // ───────────────────────────────────────────────────────────────────────
  //  Equipment
  // ───────────────────────────────────────────────────────────────────────
  const metal = mat(0x9aa3a2, 0.3, 0.75);
  const rubber = mat(0x2b322e, 0.7, 0.15);
  const machineMat = mat(0x37423c, 0.55, 0.4);
  const accentMat = mat(0x16a34a, 0.5, 0.15);
  const warmMat = mat(0xf97316, 0.55, 0.1);

  const createDumbbells = () => {
    const g = new THREE.Group();
    const build = () => {
      const d = new THREE.Group();
      const bar = mesh(cyl(0.022, 0.2, 12), metal);
      bar.rotation.z = Math.PI / 2;
      d.add(bar);
      for (const w of [-1, 1]) {
        const plate = mesh(cyl(0.07, 0.05, 16), rubber);
        plate.rotation.z = Math.PI / 2;
        plate.position.x = w * 0.11;
        d.add(plate);
        const collar = mesh(cyl(0.03, 0.03, 10), metal);
        collar.rotation.z = Math.PI / 2;
        collar.position.x = w * 0.075;
        d.add(collar);
      }
      return d;
    };
    const a = build();
    const b = build();
    a.rotation.x = Math.PI / 2;
    b.rotation.x = Math.PI / 2;
    g.add(a, b);
    return { group: g, left: a, right: b };
  };

  const createTreadmill = (): Equipment => {
    const g = new THREE.Group();
    const deck = mesh(box(0.6, 0.1, 1.5), rubber);
    deck.position.y = -0.05;
    g.add(deck);
    for (const sx of [-1, 1]) {
      const rail = mesh(cyl(0.026, 1.5, 12), metal);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(sx * 0.31, 0.03, 0);
      g.add(rail);
    }
    const post = mesh(cyl(0.032, 0.92, 12), machineMat);
    post.position.set(0, 0.46, -0.74);
    g.add(post);
    const consoleBox = mesh(box(0.46, 0.19, 0.05), machineMat);
    consoleBox.position.set(0, 0.94, -0.74);
    g.add(consoleBox);
    const screen = mesh(box(0.34, 0.11, 0.012), basic(0x22c55e, 0.85));
    screen.position.set(0, 0.94, -0.71);
    g.add(screen);
    const slats: Three.Mesh[] = [];
    for (let i = 0; i < 9; i += 1) {
      const s = mesh(box(0.52, 0.014, 0.11), basic(0x141a16, 1));
      s.position.set(0, 0.008, -0.66 + i * 0.165);
      g.add(s);
      slats.push(s);
    }
    return {
      group: g,
      update: (_t, dt) => {
        for (const s of slats) {
          s.position.z += dt * 1.1;
          if (s.position.z > 0.72) s.position.z -= 1.44;
        }
      },
    };
  };

  const createBike = (): Equipment => {
    const g = new THREE.Group();
    // base feet
    for (const sz of [-1, 1]) {
      const foot = mesh(box(0.62, 0.07, 0.1), machineMat);
      foot.position.set(0, 0.035, sz * 0.42);
      g.add(foot);
    }
    const spine = mesh(cyl(0.04, 0.9, 12), machineMat);
    spine.rotation.x = Math.PI / 2;
    spine.position.set(0, 0.12, 0);
    g.add(spine);
    // seat post + saddle
    const seatPost = mesh(cyl(0.035, 0.55, 12), machineMat);
    seatPost.position.set(0, 0.4, -0.26);
    g.add(seatPost);
    const saddle = mesh(box(0.16, 0.05, 0.26), rubber);
    saddle.position.set(0, 0.67, -0.26);
    g.add(saddle);
    // handlebar
    const hbPost = mesh(cyl(0.035, 0.5, 12), machineMat);
    hbPost.position.set(0, 0.45, 0.42);
    hbPost.rotation.x = -0.12;
    g.add(hbPost);
    const hb = mesh(cyl(0.024, 0.46, 12), metal);
    hb.rotation.z = Math.PI / 2;
    hb.position.set(0, 0.72, 0.42);
    g.add(hb);
    // flywheel
    const wheel = mesh(cyl(0.19, 0.05, 26), metal);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, 0.24, 0.5);
    g.add(wheel);
    // cranks + pedals
    const crank = new THREE.Group();
    crank.position.set(0, 0.24, 0.1);
    g.add(crank);
    const pedals: Three.Object3D[] = [];
    for (const s of [-1, 1]) {
      const arm = mesh(box(0.03, 0.2, 0.03), metal);
      arm.position.set(s * 0.075, 0, 0);
      arm.rotation.x = 0;
      crank.add(arm);
      const pedal = mesh(box(0.09, 0.02, 0.13), rubber);
      pedal.position.set(s * 0.075, -0.1, 0);
      crank.add(pedal);
      pedals.push(pedal);
    }
    return {
      group: g,
      update: (t) => {
        crank.rotation.x = -t * 5.0;
        wheel.rotation.x = -t * 5.0;
        for (const p of pedals) p.rotation.x = t * 5.0;
      },
    };
  };

  const createMat = (): Equipment => {
    const g = new THREE.Group();
    const m = mesh(box(1.15, 0.035, 0.62), accentMat);
    m.position.y = 0.018;
    g.add(m);
    for (const sz of [-1, 1]) {
      const stripe = mesh(box(1.15, 0.01, 0.05), basic(0xffffff, 0.5));
      stripe.position.set(0, 0.038, sz * 0.2);
      g.add(stripe);
    }
    return { group: g };
  };

  const createBarbell = () => {
    const g = new THREE.Group();
    const bar = mesh(cyl(0.028, 1.5, 12), metal);
    bar.rotation.z = Math.PI / 2;
    g.add(bar);
    for (const s of [-1, 1]) {
      for (const o of [0.62, 0.7]) {
        const plate = mesh(cyl(0.19, 0.05, 24), rubber);
        plate.rotation.z = Math.PI / 2;
        plate.position.x = s * o;
        g.add(plate);
      }
    }
    return g;
  };

  // ───────────────────────────────────────────────────────────────────────
  //  Workout animation
  // ───────────────────────────────────────────────────────────────────────
  const animate = (rig: Rig, workout: Workout, t: number, dt: number) => {
    const arms = [
      { s: rig.shoulderL, e: rig.elbowL, side: -1 },
      { s: rig.shoulderR, e: rig.elbowR, side: 1 },
    ];
    const legs = [
      { h: rig.hipL, k: rig.kneeL, side: -1 },
      { h: rig.hipR, k: rig.kneeR, side: 1 },
    ];

    // Reset the shared channels each frame.
    rig.root.position.set(0, 0, 0);
    if (rig.root.rotation.y !== 0) rig.root.rotation.y = 0;
    rig.pelvis.position.y = rig.baseHipY;
    rig.torso.rotation.set(0, 0, 0);
    rig.head.rotation.set(0, 0, 0);
    for (const l of legs) l.h.rotation.set(0, 0, 0);

    switch (workout) {
      case 'curl': {
        const w = t * 2.3;
        arms.forEach((a, i) => {
          const c = 0.5 - 0.5 * Math.cos(w + i * Math.PI);
          a.s.rotation.set(-0.08 + c * 0.2, 0, a.side * (0.17 + c * 0.03));
          a.e.rotation.set(-(0.42 + c * 1.85), 0, 0.02 * a.side);
        });
        legs.forEach((l) => {
          l.h.rotation.set(-0.04, 0, 0);
          l.k.rotation.x = 0.09;
        });
        rig.pelvis.position.y = rig.baseHipY - (0.02 + 0.02 * Math.abs(Math.sin(w)));
        rig.torso.rotation.set(0.05, Math.sin(w * 0.5) * 0.05, 0);
        rig.head.rotation.set(-0.04, Math.sin(w * 0.5) * 0.07, 0);
        break;
      }
      case 'squat': {
        const w = t * 1.5;
        const t01 = 0.5 - 0.5 * Math.cos(w);
        const hipFlex = 1.0 * t01;
        const kneeFlex = 2.0 * t01;
        legs.forEach((l) => {
          l.h.rotation.x = -hipFlex;
          l.k.rotation.x = kneeFlex;
        });
        rig.pelvis.position.y = rig.baseHipY - 0.4 * t01;
        rig.torso.rotation.set(0.3 * t01 + 0.02, 0, 0);
        arms.forEach((a) => {
          a.s.rotation.set(-(0.5 + 0.55 * t01), 0, a.side * (0.12 + 0.05 * t01));
          a.e.rotation.set(-(0.35 + 0.55 * (1 - t01)), 0, 0);
        });
        rig.head.rotation.set(-0.22 * t01 - 0.02, 0, 0);
        break;
      }
      case 'run': {
        const w = t * 7.6;
        legs.forEach((l, i) => {
          const p = i * Math.PI;
          l.h.rotation.x = -0.12 + 0.82 * Math.sin(w + p);
          l.k.rotation.x = 0.45 + 0.9 * Math.max(0, Math.sin(w + p + 1.7));
        });
        arms.forEach((a, i) => {
          const p = i * Math.PI + Math.PI;
          a.s.rotation.set(-0.22 + 0.62 * Math.sin(w + p), 0, a.side * (0.13 + 0.03 * Math.sin(w + p)));
          a.e.rotation.set(-(1.15 + 0.4 * Math.max(0, Math.sin(w + p))), 0, 0);
        });
        rig.pelvis.position.y = rig.baseHipY + 0.035 * Math.abs(Math.sin(w));
        rig.torso.rotation.set(0.17, 0.05 * Math.sin(w), 0);
        rig.head.rotation.set(-0.16, 0, 0);
        break;
      }
      case 'cycle': {
        const w = t * 5.0;
        legs.forEach((l, i) => {
          const p = i * Math.PI;
          l.h.rotation.x = -(0.92 + 0.26 * Math.sin(w + p));
          l.k.rotation.x = 1.62 + 0.85 * Math.sin(w + p + 2.3);
        });
        rig.pelvis.position.y = rig.baseHipY - 0.3;
        rig.torso.rotation.set(0.42, 0, 0);
        arms.forEach((a) => {
          a.s.rotation.set(-1.16, 0, a.side * 0.06);
          a.e.rotation.set(-0.22, 0, 0);
        });
        rig.head.rotation.set(-0.34, 0.04 * Math.sin(w * 0.5), 0);
        break;
      }
      default: {
        // stretch — gentle overhead side bend
        const s = Math.sin(t * 0.9);
        const s2 = Math.sin(t * 0.9 + 0.35);
        arms.forEach((a) => {
          a.s.rotation.set(-2.55 + s2 * 0.08, 0, a.side * (0.3 + s * 0.12));
          a.e.rotation.set(-0.12, 0, 0);
        });
        rig.hipL.rotation.set(0.02, 0, 0.15);
        rig.hipR.rotation.set(-0.02, 0, -0.15);
        rig.kneeL.rotation.x = 0.07;
        rig.kneeR.rotation.x = 0.07;
        rig.pelvis.position.y = rig.baseHipY + Math.abs(s) * 0.012;
        rig.torso.rotation.set(-0.03, 0, s * 0.24);
        rig.head.rotation.set(-0.05, 0, s * 0.17);
        break;
      }
    }

    // secondary motion for hair / accessories
    const speed = workout === 'run' ? 8 : workout === 'cycle' ? 5 : workout === 'curl' ? 2.3 : 1.4;
    for (let i = 0; i < rig.sway.length; i += 1) {
      const o = rig.sway[i];
      o.rotation.z = Math.sin(t * speed * 0.5 + i) * 0.12;
      o.rotation.x = (o.userData.base ?? 0) + 0.06 * Math.sin(t * speed * 0.6 + i);
    }
    void dt;
  };

  const dispose = () => {
    for (const g of geoms) g.dispose();
    for (const m of mats) m.dispose();
    for (const tx of textures) tx.dispose();
    geoms.length = 0;
    mats.length = 0;
    textures.length = 0;
    gCache.clear();
    mCache.clear();
    bCache.clear();
  };

  return {
    createCharacter,
    createDumbbells,
    createTreadmill,
    createBike,
    createMat,
    createBarbell,
    animate,
    shadow,
    dispose,
    stats: { geoms, mats },
  };
}

/** female torso uses the top colour for the whole torso */
function skinTop(topM: Three.MeshStandardMaterial, _skinM: Three.MeshStandardMaterial) {
  return topM;
}

export type FitnessKit = ReturnType<typeof createFitnessKit>;
