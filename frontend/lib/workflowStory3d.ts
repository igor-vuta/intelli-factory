import * as THREE from 'three';

/* The landing's workflow story in six chapters: a customer sends a request; it travels among a
   flood of other customers' requests to many factories and reaches the one factory that makes
   it; the factory answers and hands the offer to a carrier; the carrier traces and prices the
   route; the three gather and their proposals go into the optimisation engine; the engine
   returns the proposals as a list. Illustrative (no figures are claimed; the list shown over the
   last chapter is real benchmark data rendered in HTML).

   The timeline runs from 0 to 6, one unit per chapter. The page sets a target at the end of the
   chapter being read, and the scene plays toward it at its own pace, so each chapter is an
   animated beat rather than a scroll scrub. Loaded on demand by WorkflowStory.tsx. */

export type StoryPalette = {
  bg: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  surface: string;
};

export type StoryHandles = {
  /** Target position on the 0–6 timeline; the scene animates toward it. */
  setProgress: (chapterTime: number) => void;
  /** Paused: no ambient motion, and chapter changes snap instead of playing. */
  setPaused: (paused: boolean) => void;
  setPalette: (palette: StoryPalette) => void;
  destroy: () => void;
};

type Vec = [number, number, number];

export const STORY_CHAPTERS = 6;
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpVec = (a: Vec, b: Vec, t: number): Vec => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
/** A quick hop in the first 30% of a chapter: the "something changed" cue. */
const hop = (local: number) => (local < 0.3 ? Math.sin((local / 0.3) * Math.PI) * 0.45 : 0);

// Deterministic randomness, so every visit (and every captured still) shows the same scene.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// The map: customers on the left, factories on the right, the carrier's depot in between.
const SPOT = {
  customer: [-7.5, 0, 4] as Vec,
  factory: [7.2, 0, -3.2] as Vec,
  logist: [3.6, 0, -7.4] as Vec,
};
const FACTORY_SITE: Vec = [9.6, 0, -4.5];
const TERMINAL: Vec = [SPOT.customer[0] + 0.85, 1.05, SPOT.customer[2] + 0.35];
const HERO_START = new THREE.Vector3(TERMINAL[0], 1.9, TERMINAL[2]);
const HERO_CONTROL = new THREE.Vector3(-1, 6.5, -1.5);
const HERO_DOCK = new THREE.Vector3(SPOT.factory[0] + 0.1, 1.5, SPOT.factory[2] - 0.5);
const LOGIST_HAND = new THREE.Vector3(SPOT.logist[0] + 0.3, 1.5, SPOT.logist[2] + 0.4);
const COINS: Vec = [SPOT.logist[0] - 1.2, 0, SPOT.logist[2] + 1];
const FACTORY_SLOTS = 8;
const OUR_SLOT = 2;
const factorySlot = (i: number): Vec => [
  i === OUR_SLOT ? FACTORY_SITE[0] : 10 + ((i * 37) % 5) * 0.35,
  0,
  i === OUR_SLOT ? FACTORY_SITE[2] : -10.5 + i * 3,
];
const CIRCLE_R = 5;
const ring = (deg: number): Vec => [
  CIRCLE_R * Math.cos((deg * Math.PI) / 180),
  0,
  CIRCLE_R * Math.sin((deg * Math.PI) / 180),
];
const SEAT = { customer: ring(150), factory: ring(270), logist: ring(30) };
const CORE = new THREE.Vector3(0, 1.9, 0);

// Camera framing: SHOTS[0] is the resting frame before the story starts, SHOTS[k + 1] the frame
// chapter k settles on. Each chapter eases from its predecessor's frame in its first 60%.
const SHOTS: [Vec, Vec][] = [
  [
    [-2.6, 3.6, 12.5],
    [-7.5, 1.2, 4],
  ],
  [
    [-4.4, 2.6, 9.2],
    [-7.8, 1.4, 3.6],
  ],
  [
    [-4, 17, 17],
    [0.5, 0, 0],
  ],
  [
    [3.6, 5, 3.6],
    [7.6, 1.2, -4.4],
  ],
  [
    [0.5, 18, 12],
    [0, 0, -1],
  ],
  [
    [0, 21, 0.01],
    [0, 0, 0],
  ],
  [
    [0, 8, 13],
    [0, -0.6, 0],
  ],
];

const PAWN_PROFILE = [
  [0, 0],
  [0.42, 0],
  [0.45, 0.08],
  [0.36, 0.5],
  [0.28, 0.95],
  [0.2, 1.15],
  [0, 1.2],
].map(([x, y]) => new THREE.Vector2(x, y));

function pawn(
  material: THREE.Material,
  bodyGeometry: THREE.BufferGeometry,
  headGeometry: THREE.BufferGeometry
) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeometry, material);
  const head = new THREE.Mesh(headGeometry, material);
  head.position.y = 1.42;
  group.add(body, head);
  return group;
}

export function mountStory(
  host: HTMLElement,
  palette: StoryPalette,
  options: {
    lite: boolean;
    /** Name tags the scene keeps above each person (HTML, so they are translated). */
    labels?: Partial<Record<'customer' | 'factory' | 'logist', HTMLElement>>;
  },
  onSlow: () => void
): StoryHandles | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !options.lite, alpha: false });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.lite ? 1.5 : 2));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.className = 'story-canvas';
  host.appendChild(renderer.domElement);

  const random = seeded(7);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(palette.bg, 26, 60);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(item: T) => (disposables.push(item), item);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-6, 12, 8);
  scene.add(key);
  const glow = new THREE.PointLight(palette.accent, 0, 14, 1.6);
  glow.position.copy(CORE);
  scene.add(glow);

  // Floor grid.
  const gridMaterial = keep(new THREE.LineBasicMaterial({ transparent: true, opacity: 0.5 }));
  const gridPoints: number[] = [];
  for (let i = -24; i <= 24; i += 2) gridPoints.push(i, 0, -24, i, 0, 24, -24, 0, i, 24, 0, i);
  const gridGeometry = keep(new THREE.BufferGeometry());
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
  scene.add(new THREE.LineSegments(gridGeometry, gridMaterial));

  const figureMaterial = keep(new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 }));
  const crowdMaterial = keep(
    new THREE.MeshStandardMaterial({ roughness: 0.7, transparent: true, opacity: 0.55 })
  );
  const propMaterial = keep(new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.05 }));
  const accentMaterial = keep(
    new THREE.MeshStandardMaterial({ roughness: 0.3, emissiveIntensity: 0.8 })
  );
  const packetMaterial = keep(
    new THREE.MeshStandardMaterial({ roughness: 0.5, emissiveIntensity: 0.12 })
  );
  const additive = () =>
    keep(
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );

  const box = keep(new THREE.BoxGeometry(1, 1, 1));
  const cylinder = keep(new THREE.CylinderGeometry(0.18, 0.22, 1, 16));
  const pawnBody = keep(new THREE.LatheGeometry(PAWN_PROFILE, 28));
  const pawnHead = keep(new THREE.SphereGeometry(0.22, 24, 16));

  // Our three people.
  const people = {
    customer: pawn(figureMaterial, pawnBody, pawnHead),
    factory: pawn(figureMaterial, pawnBody, pawnHead),
    logist: pawn(figureMaterial, pawnBody, pawnHead),
  };
  Object.values(people).forEach((p) => scene.add(p));
  const WHO = ['customer', 'factory', 'logist'] as const;

  // Everyone else's customers: a crowd on the left, each sending requests.
  const crowd: Vec[] = [];
  while (crowd.length < 17) {
    const spot: Vec = [-15 + random() * 6.5, 0, -11 + random() * 14];
    // Keep the crowd behind our customer, never between them and the opening camera.
    const clear =
      Math.hypot(spot[0] - SPOT.customer[0], spot[2] - SPOT.customer[2]) > 3 &&
      crowd.every((o) => Math.hypot(o[0] - spot[0], o[2] - spot[2]) > 2);
    if (clear) crowd.push(spot);
  }
  const crowdBodies = new THREE.InstancedMesh(pawnBody, crowdMaterial, crowd.length);
  const crowdHeads = new THREE.InstancedMesh(pawnHead, crowdMaterial, crowd.length);
  crowdBodies.frustumCulled = crowdHeads.frustumCulled = false;
  scene.add(crowdBodies, crowdHeads);

  // Factories on the right: ours in detail, the others as simple blocks.
  const others = Array.from({ length: FACTORY_SLOTS }, (_, i) => i).filter((i) => i !== OUR_SLOT);
  const factoryBlocks = new THREE.InstancedMesh(box, propMaterial, others.length);
  const factoryStacks = new THREE.InstancedMesh(cylinder, propMaterial, others.length);
  factoryBlocks.frustumCulled = factoryStacks.frustumCulled = false;
  scene.add(factoryBlocks, factoryStacks);

  const factory = new THREE.Group();
  for (const [x, y, z, sx, sy, sz] of [
    [0, 0.7, 0, 2.6, 1.4, 1.8],
    [1.2, 1.1, 0, 1, 2.2, 1.4],
  ]) {
    const part = new THREE.Mesh(box, propMaterial);
    part.position.set(x, y, z);
    part.scale.set(sx, sy, sz);
    factory.add(part);
  }
  for (const x of [-0.7, 0, 0.7]) {
    const stack = new THREE.Mesh(cylinder, propMaterial);
    stack.position.set(x, 2, -0.4);
    stack.scale.y = 1.4;
    factory.add(stack);
  }
  factory.position.set(FACTORY_SITE[0], 0, FACTORY_SITE[2]);
  factory.rotation.y = -Math.PI / 2;
  scene.add(factory);
  const beamMaterial = additive();
  const beam = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(0.06, 0.9, 7, 16, 1, true)),
    beamMaterial
  );
  beam.position.set(FACTORY_SITE[0], 3.5, FACTORY_SITE[2]);
  scene.add(beam);

  const terminal = new THREE.Mesh(
    keep(new THREE.BoxGeometry(1.2, 0.04, 0.8)),
    keep(new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.35, roughness: 0.1 }))
  );
  terminal.position.set(...TERMINAL);
  terminal.rotation.x = -0.5;
  scene.add(terminal);

  const truck = new THREE.Group();
  const cargo = new THREE.Mesh(box, propMaterial);
  cargo.scale.set(2.2, 1.1, 1);
  cargo.position.set(0, 0.85, 0);
  const cab = new THREE.Mesh(box, propMaterial);
  cab.scale.set(0.8, 0.8, 0.95);
  cab.position.set(1.55, 0.7, 0);
  truck.add(cargo, cab);
  const wheel = keep(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 16));
  for (const [x, z] of [
    [-0.6, 0.5],
    [-0.6, -0.5],
    [1.4, 0.5],
    [1.4, -0.5],
  ]) {
    const w = new THREE.Mesh(wheel, propMaterial);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.22, z);
    truck.add(w);
  }
  scene.add(truck);

  // The carrier's route: depot, factory dock, then across to the customer. Sampled once.
  const route = new THREE.CatmullRomCurve3(
    [
      [SPOT.logist[0] + 2, -8.4],
      [7.4, -1.6],
      [4.5, 2],
      [0, 4.6],
      [-3.6, 5.8],
      [-6.3, 5],
    ].map(([x, z]) => new THREE.Vector3(x, 0.06, z))
  );
  const SAMPLES = 256;
  const routeTable = new Float32Array((SAMPLES + 1) * 3);
  {
    const sample = new THREE.Vector3();
    for (let k = 0; k <= SAMPLES; k++) {
      route.getPoint(k / SAMPLES, sample);
      routeTable.set([sample.x, sample.y, sample.z], k * 3);
    }
  }
  const sampleRoute = (u: number, out: THREE.Vector3) => {
    const f = Math.min(SAMPLES - 1e-6, Math.max(0, u * SAMPLES));
    const k = Math.floor(f);
    const w = f - k;
    const r = routeTable;
    return out.set(
      r[k * 3] + (r[k * 3 + 3] - r[k * 3]) * w,
      r[k * 3 + 1] + (r[k * 3 + 4] - r[k * 3 + 1]) * w,
      r[k * 3 + 2] + (r[k * 3 + 5] - r[k * 3 + 2]) * w
    );
  };
  const TUBE_SEGMENTS = 200;
  const TUBE_SIDES = 6;
  const routeGeometry = keep(new THREE.TubeGeometry(route, TUBE_SEGMENTS, 0.07, TUBE_SIDES));
  const routeMaterial = keep(new THREE.MeshBasicMaterial({ transparent: true }));
  const routeLine = new THREE.Mesh(routeGeometry, routeMaterial);
  scene.add(routeLine);

  // The request's own trail, drawn behind it: customer → factory, then factory → carrier. With
  // the route that follows, it leaves the whole hand-off chain on the map.
  const trailSegment = (at: (u: number, out: THREE.Vector3) => THREE.Vector3) => {
    const curve = new THREE.CatmullRomCurve3(
      Array.from({ length: 33 }, (_, k) => at(k / 32, new THREE.Vector3()))
    );
    // The tube is laid out by arc length; map the request's own parameter onto it.
    const lengths = curve.getLengths(128);
    const geometry = keep(new THREE.TubeGeometry(curve, 128, 0.045, TUBE_SIDES));
    const mesh = new THREE.Mesh(geometry, trailMaterial);
    scene.add(mesh);
    return (u: number) => {
      const shown = lengths[Math.round(clamp01(u) * 128)] / lengths[128];
      geometry.setDrawRange(0, Math.floor(shown * 128) * TUBE_SIDES * 6);
      mesh.visible = shown > 0;
    };
  };
  const trailMaterial = keep(new THREE.MeshBasicMaterial({ transparent: true }));
  const trailToFactory = trailSegment((u, out) =>
    bezier(HERO_START, HERO_CONTROL, HERO_DOCK, u, out)
  );
  const trailToCarrier = trailSegment((u, out) => {
    out.lerpVectors(HERO_DOCK, LOGIST_HAND, u);
    out.y += Math.sin(u * Math.PI) * 1.3;
    return out;
  });

  // The price the carrier arrives at, as a growing stack of coins.
  const coinGeometry = keep(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 24));
  const coins = Array.from({ length: 5 }, (_, i) => {
    const coin = new THREE.Mesh(coinGeometry, accentMaterial);
    coin.position.set(COINS[0] + (i % 2) * 0.05, 0.06 + i * 0.12, COINS[2]);
    scene.add(coin);
    return coin;
  });

  // The flood: every other customer's requests arcing to every factory.
  const floodCount = options.lite ? 700 : 1600;
  const packetGeometry = keep(new THREE.BoxGeometry(0.13, 0.13, 0.13));
  const flood = new THREE.InstancedMesh(packetGeometry, packetMaterial, floodCount);
  // Per packet: start xz, control xz, end xz, arc height, phase, speed.
  const paths = new Float32Array(floodCount * 9);
  for (let i = 0; i < floodCount; i++) {
    const from = crowd[i % crowd.length];
    const to = factorySlot(Math.floor(random() * FACTORY_SLOTS));
    paths.set(
      [
        from[0] + (random() - 0.5) * 0.6,
        from[2] + (random() - 0.5) * 0.6,
        (from[0] + to[0]) / 2 + (random() - 0.5) * 4,
        (from[2] + to[2]) / 2 + (random() - 0.5) * 8,
        to[0] - 1.4 + (random() - 0.5) * 0.6,
        to[2] + (random() - 0.5) * 1.2,
        0.4 + random() * 2,
        random(),
        0.7 + random() * 0.6,
      ],
      i * 9
    );
  }
  // Instances move every frame; a bounding sphere computed once would cull them.
  flood.frustumCulled = false;
  scene.add(flood);

  // Our request, its offer, and the cue that marks each chapter change.
  const hero = new THREE.Mesh(keep(new THREE.BoxGeometry(0.34, 0.34, 0.34)), accentMaterial);
  scene.add(hero);
  const offerShape = new THREE.Mesh(keep(new THREE.OctahedronGeometry(0.17)), accentMaterial);
  scene.add(offerShape);
  const pulse = new THREE.Mesh(keep(new THREE.TorusGeometry(1, 0.03, 8, 64)), additive());
  pulse.rotation.x = Math.PI / 2;
  scene.add(pulse);

  const haloTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,0.9)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.25)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return keep(new THREE.CanvasTexture(c));
  })();
  const sprite = () =>
    new THREE.Sprite(
      keep(
        new THREE.SpriteMaterial({
          map: haloTexture,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      )
    );
  const heroHalo = sprite();
  const flash = sprite();
  const coreHalo = sprite();
  scene.add(heroHalo, flash, coreHalo);

  // Rings at people's feet: lit for whoever the chapter is about, and for all once gathered.
  const feetGeometry = keep(new THREE.TorusGeometry(0.62, 0.025, 6, 48));
  const feet = {
    customer: new THREE.Mesh(feetGeometry, additive()),
    factory: new THREE.Mesh(feetGeometry, additive()),
    logist: new THREE.Mesh(feetGeometry, additive()),
  };
  for (const ringMesh of Object.values(feet)) {
    ringMesh.rotation.x = Math.PI / 2;
    scene.add(ringMesh);
  }

  // The engine: a pedestal, a faceted core and three orbiting rings.
  const engine = new THREE.Group();
  const pedestal = new THREE.Mesh(keep(new THREE.CylinderGeometry(1, 1.3, 0.6, 32)), propMaterial);
  pedestal.position.y = 0.3;
  const coreMaterial = keep(
    new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.3, flatShading: true })
  );
  const core = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(0.75, 1)), coreMaterial);
  core.position.copy(CORE);
  engine.add(pedestal, core);
  const orbits = [1.25, 1.5, 1.75].map((radius) => {
    const orbit = new THREE.Mesh(keep(new THREE.TorusGeometry(radius, 0.04, 8, 96)), propMaterial);
    orbit.position.copy(CORE);
    engine.add(orbit);
    return orbit;
  });
  scene.add(engine);
  const circleLine = new THREE.Mesh(
    keep(new THREE.TorusGeometry(CIRCLE_R, 0.025, 6, 128)),
    keep(new THREE.MeshBasicMaterial({ transparent: true }))
  );
  circleLine.rotation.x = Math.PI / 2;
  circleLine.position.y = 0.02;
  scene.add(circleLine);

  const nodeCount = 18;
  const nodes = new THREE.InstancedMesh(packetGeometry, packetMaterial, nodeCount);
  nodes.frustumCulled = false;
  scene.add(nodes);

  // The proposals the engine returns: a list of cards, ours among them.
  const OUR_CARD = 2;
  const cardGeometry = keep(new THREE.BoxGeometry(2.6, 0.42, 0.06));
  const cardMaterial = keep(new THREE.MeshStandardMaterial({ roughness: 0.6 }));
  const cards = Array.from({ length: 5 }, (_, i) => {
    const card = new THREE.Mesh(cardGeometry, i === OUR_CARD ? accentMaterial : cardMaterial);
    scene.add(card);
    return card;
  });

  function setPalette(p: StoryPalette) {
    renderer.setClearColor(p.bg);
    (scene.fog as THREE.Fog).color.set(p.bg);
    gridMaterial.color.set(p.line);
    figureMaterial.color.set(p.muted);
    crowdMaterial.color.set(p.muted);
    propMaterial.color.set(p.surface);
    cardMaterial.color.set(p.surface);
    // Muted grey in both modes, so the flood reads as a texture and our request stands out.
    packetMaterial.color.set(p.muted);
    packetMaterial.emissive.set(p.muted);
    for (const material of [accentMaterial, coreMaterial]) {
      material.color.set(p.accent);
      material.emissive.set(p.accent);
    }
    trailMaterial.color.set(p.accent);
    for (const mesh of [pulse, routeLine, circleLine, beam, ...Object.values(feet)]) {
      (mesh.material as THREE.MeshBasicMaterial).color.set(p.accent);
    }
    for (const s of [heroHalo, flash, coreHalo]) s.material.color.set(p.accent);
    glow.color.set(p.accent);
  }
  setPalette(palette);

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const point = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const truckTop = new THREE.Vector3();
  const upright = new THREE.Quaternion();

  function placeInstance(mesh: THREE.InstancedMesh, i: number, at: Vec, size: Vec, y = 0) {
    position.set(at[0], at[1] + y, at[2]);
    scale.set(...size);
    matrix.compose(position, upright, scale);
    mesh.setMatrixAt(i, matrix);
  }

  function place(t: number, clock: number) {
    const chapter = Math.min(STORY_CHAPTERS - 1, Math.floor(t));
    const local = t - chapter;

    // Camera: ease from the previous frame into this chapter's, then hold while it is read.
    const k = smooth(clamp01(local / 0.6));
    const [p0, l0] = SHOTS[chapter];
    const [p1, l1] = SHOTS[chapter + 1];
    camera.position.set(...lerpVec(p0, p1, k));
    lookTarget.set(...lerpVec(l0, l1, k));
    // Narrow stages (phones) step back so wide shots still fit.
    if (camera.aspect < 1.4) {
      camera.position.sub(lookTarget).multiplyScalar((1.4 / camera.aspect) ** 0.85);
      camera.position.add(lookTarget);
    }
    camera.lookAt(lookTarget);

    // Chapter 5 clears the map: the crowd, the other factories and the props fade away.
    const gather = smooth(span(t, 4, 4.35));
    const fade = Math.max(0.001, 1 - smooth(span(t, 4, 4.3)));
    crowd.forEach((spot, i) => {
      placeInstance(crowdBodies, i, spot, [0.75 * fade, 0.75 * fade, 0.75 * fade]);
      placeInstance(crowdHeads, i, spot, [0.75 * fade, 0.75 * fade, 0.75 * fade], 1.42 * 0.75);
    });
    others.forEach((slot, i) => {
      const at = factorySlot(slot);
      placeInstance(factoryBlocks, i, at, [1.6 * fade, 1.3 * fade, 2.2 * fade], 0.65 * fade);
      placeInstance(factoryStacks, i, [at[0] + 0.4, 0, at[2] - 0.5], [fade, 1.2 * fade, fade], 1.6);
    });
    for (const mesh of [crowdBodies, crowdHeads, factoryBlocks, factoryStacks]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    factory.scale.setScalar(fade);
    terminal.scale.setScalar(fade);
    truck.scale.setScalar(fade);

    // People: hop when their chapter starts, walk to the circle in chapter 5.
    const hops = {
      customer: chapter === 0 ? hop(local) : 0,
      factory: chapter === 2 ? hop(local) : 0,
      logist: chapter === 3 ? hop(local) : 0,
    };
    for (const who of WHO) {
      people[who].position.set(...lerpVec(SPOT[who], SEAT[who], gather));
      people[who].position.y = hops[who];
      if (gather > 0) people[who].lookAt(0, hops[who], 0);
      else people[who].rotation.set(0, who === 'customer' ? 0.6 : -0.9, 0);
    }
    const gathered = span(t, 4.15, 4.4);
    const focus = {
      customer: 1 - span(t, 1, 1.3),
      factory: span(t, 2, 2.2) * (1 - span(t, 2.9, 3.1)),
      logist: span(t, 3, 3.2) * (1 - span(t, 3.9, 4.1)),
    };
    for (const who of WHO) {
      const ringMesh = feet[who];
      const opacity = t > 0.02 ? Math.max(focus[who], gathered) : 0;
      ringMesh.position.set(people[who].position.x, 0.03, people[who].position.z);
      ringMesh.scale.setScalar(1 + (hops[who] > 0 ? hops[who] * 0.8 : 0));
      (ringMesh.material as THREE.MeshBasicMaterial).opacity = opacity;
      ringMesh.visible = opacity > 0.01;
    }

    // The flood runs from chapter 2 until the gathering.
    // It thins out around the factory close-up so the hand-over stays readable.
    const quiet = 1 - 0.75 * span(t, 2, 2.2) * (1 - span(t, 3, 3.2));
    const level = span(t, 1, 1.25) * (1 - span(t, 3.6, 4.1)) * quiet;
    const count = Math.floor(floodCount * level);
    flood.count = count;
    for (let i = 0; i < count; i++) {
      const o = i * 9;
      const u = (paths[o + 7] + clock * 0.08 * paths[o + 8]) % 1;
      const a = (1 - u) * (1 - u);
      const b = 2 * u * (1 - u);
      const c = u * u;
      position.set(
        a * paths[o] + b * paths[o + 2] + c * paths[o + 4],
        0.3 + paths[o + 6] * 4 * u * (1 - u),
        a * paths[o + 1] + b * paths[o + 3] + c * paths[o + 5]
      );
      scale.setScalar(Math.min(1, u * 12, (1 - u) * 12) * (0.7 + (i % 5) * 0.12));
      matrix.compose(position, quaternion, scale);
      flood.setMatrixAt(i, matrix);
    }
    flood.instanceMatrix.needsUpdate = true;
    // Only our factory lights up as our request arrives.
    beamMaterial.opacity = 0.22 * span(t, 1.55, 1.85) * (1 - span(t, 3.6, 4));
    beam.visible = beamMaterial.opacity > 0.005;

    // The carrier traces the route in chapter 4; the truck follows the line as it is drawn.
    const draw = smooth(span(t, 3.1, 3.85));
    routeGeometry.setDrawRange(0, Math.floor(draw * TUBE_SEGMENTS) * TUBE_SIDES * 6);
    routeMaterial.opacity = 1 - span(t, 4, 4.3);
    routeLine.visible = draw > 0 && routeMaterial.opacity > 0;
    sampleRoute(draw, point);
    sampleRoute(Math.min(1, draw + 0.01), ahead);
    truck.position.set(point.x, 0, point.z);
    truck.rotation.y = -Math.atan2(ahead.z - point.z, ahead.x - point.x);
    truckTop.set(point.x, 1.75 * fade, point.z);
    coins.forEach((coin, i) => {
      const pop = smooth(span(t, 3.45 + i * 0.08, 3.55 + i * 0.08)) * fade;
      coin.scale.setScalar(Math.max(0.001, pop));
      coin.visible = pop > 0.01;
    });

    // Our request: made at the terminal, carried to our factory, handed to the carrier, driven
    // along the route, then taken into the engine.
    const leave = smooth(span(t, 0.7, 1));
    const toFactory = t < 1 ? leave * 0.06 : lerp(0.06, 1, smooth(span(t, 1.1, 1.85)));
    const handover = smooth(span(t, 2.55, 2.95));
    trailToFactory(toFactory - 0.02);
    trailToCarrier(handover - 0.02);
    trailMaterial.opacity = 0.85 * (1 - span(t, 4, 4.3));
    if (t < 1) {
      const rise = smooth(span(t, 0.25, 0.6));
      hero.position.set(TERMINAL[0], lerp(1.35, HERO_START.y, rise), TERMINAL[2]);
      if (leave > 0) bezier(HERO_START, HERO_CONTROL, HERO_DOCK, toFactory, hero.position);
    } else if (t < 2) {
      bezier(HERO_START, HERO_CONTROL, HERO_DOCK, toFactory, hero.position);
    } else if (t < 3) {
      hero.position.lerpVectors(HERO_DOCK, LOGIST_HAND, handover);
      hero.position.y += Math.sin(handover * Math.PI) * 1.3;
    } else if (t < 4) {
      hero.position.lerpVectors(LOGIST_HAND, truckTop, smooth(span(t, 3, 3.15)));
    } else {
      hero.position.lerpVectors(truckTop, CORE, smooth(span(t, 4.3, 4.65)));
    }
    const made = smooth(span(t, 0.08, 0.3));
    // Larger while it travels among the flood, so it is easy to follow.
    const among = 1 + 0.8 * span(t, 1, 1.2) * (1 - span(t, 1.85, 2.1));
    hero.scale.setScalar(Math.max(0.001, made * among));
    hero.rotation.set(clock * 0.6, clock * 0.8, 0);
    hero.visible = made > 0 && t < 4.66;
    heroHalo.visible = hero.visible;
    heroHalo.position.copy(hero.position);
    heroHalo.scale.setScalar(1.6 * made * among * among);

    offerShape.visible = t > 2.3 && t < 4.66;
    offerShape.scale.setScalar(Math.max(0.001, smooth(span(t, 2.3, 2.45))));
    offerShape.position.set(hero.position.x + 0.34, hero.position.y + 0.1, hero.position.z);
    offerShape.rotation.y = clock;

    // Notification at the factory.
    const ping = span(t, 2, 2.45);
    pulse.visible = ping > 0 && ping < 1;
    pulse.position.set(SPOT.factory[0], 0.05, SPOT.factory[2]);
    pulse.scale.setScalar(0.4 + ping * 2.4);
    (pulse.material as THREE.MeshBasicMaterial).opacity = 1 - ping;

    // The engine rises in chapter 5; proposals flow in and it spins up.
    const rise = smooth(span(t, 4, 4.3));
    engine.visible = rise > 0;
    engine.scale.setScalar(Math.max(0.001, rise));
    const intake = span(t, 4.35, 4.95);
    const spin = clock * 0.5 + t * 1.6;
    orbits.forEach((orbit, i) =>
      orbit.rotation.set(spin * (0.6 + i * 0.3), spin * (1 - i * 0.25), 0)
    );
    core.rotation.set(spin * 0.3, spin * 0.45, 0);
    const answer = span(t, 5, 5.35);
    coreMaterial.emissiveIntensity = 0.2 + intake * 0.8 + Math.sin(answer * Math.PI) * 1.5;
    coreHalo.visible = rise > 0;
    coreHalo.position.copy(CORE);
    coreHalo.scale.setScalar(rise * (3 + intake * 1.5 + Math.sin(answer * Math.PI) * 3));
    glow.intensity = rise * (4 + intake * 10);
    const circle = span(t, 4.15, 4.4);
    circleLine.visible = circle > 0;
    (circleLine.material as THREE.MeshBasicMaterial).opacity = circle;
    nodes.count = intake > 0 && intake < 1 ? nodeCount : 0;
    const seats = [SEAT.customer, SEAT.factory, SEAT.logist];
    for (let i = 0; i < nodes.count; i++) {
      const seat = seats[i % 3];
      const lag = Math.floor(i / 3) / (nodeCount / 3);
      const u = smooth(clamp01(intake * 1.6 - lag * 0.6));
      position.set(
        lerp(seat[0] * 0.85, CORE.x, u),
        lerp(0.5, CORE.y, u) + Math.sin(u * Math.PI) * 0.8,
        lerp(seat[2] * 0.85, CORE.z, u)
      );
      scale.setScalar(1 - u * 0.6);
      matrix.compose(position, quaternion, scale);
      nodes.setMatrixAt(i, matrix);
    }
    nodes.instanceMatrix.needsUpdate = true;

    // Chapter 6: the engine sends the proposals out as a list, which then flies to the reader
    // (where the page shows it as a real list).
    cards.forEach((card, i) => {
      const out = smooth(span(t, 5.08 + i * 0.05, 5.4 + i * 0.05));
      const fly = smooth(span(t, 5.55, 5.9));
      card.position.set(
        lerp(CORE.x, 0, out),
        lerp(CORE.y, 3.5 - i * 0.55, out),
        lerp(CORE.z, 2.4, out)
      );
      card.position.lerp(camera.position, fly * 0.85);
      card.scale.setScalar(Math.max(0.001, out * (1 - fly * 0.5)));
      card.lookAt(camera.position);
      card.visible = out > 0.01 && fly < 0.98;
    });
    const ours = cards[OUR_CARD];
    if (ours.visible) {
      heroHalo.visible = true;
      heroHalo.position.copy(ours.position);
      heroHalo.scale.setScalar(3 * ours.scale.x * (1 + Math.sin(clock * 5) * 0.08));
    }

    // Each chapter opens with a flash on what it is about.
    const focusPoint =
      chapter === 0
        ? people.customer.position
        : chapter === 1
          ? hero.position
          : chapter === 2
            ? people.factory.position
            : chapter === 3
              ? people.logist.position
              : CORE;
    const burst = span(local, 0, 0.4);
    flash.visible = t > 0.02 && burst < 1;
    flash.position.set(focusPoint.x, (chapter >= 4 ? CORE.y : 1.2) + 0.2, focusPoint.z);
    flash.scale.setScalar(1 + burst * 5);
    flash.material.opacity = (1 - burst) * 0.9;
  }

  function bezier(
    a: THREE.Vector3,
    control: THREE.Vector3,
    b: THREE.Vector3,
    u: number,
    out: THREE.Vector3
  ) {
    const p = (1 - u) * (1 - u);
    const q = 2 * u * (1 - u);
    const r = u * u;
    return out.set(
      p * a.x + q * control.x + r * b.x,
      p * a.y + q * control.y + r * b.y,
      p * a.z + q * control.z + r * b.z
    );
  }

  let width = 1;
  let height = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    width = r.width;
    height = r.height;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  // Name tags: projected above each person's head; the chapter's own actor is highlighted.
  const ACTOR = ['customer', 'customer', 'factory', 'logist'] as const;
  const anchor = new THREE.Vector3();
  function placeLabels(t: number) {
    const chapter = Math.floor(t);
    const fadeOut = 1 - span(t, 5, 5.3);
    for (const who of WHO) {
      const label = options.labels?.[who];
      if (!label) continue;
      anchor.copy(people[who].position);
      anchor.y += 2.05;
      anchor.project(camera);
      const inView = anchor.z < 1 && Math.abs(anchor.x) < 1.1 && Math.abs(anchor.y) < 1.1;
      label.style.opacity = inView ? String(fadeOut) : '0';
      // Keep the whole tag inside the stage, even when its person is near an edge.
      const half = label.offsetWidth / 2 + 6;
      const x = Math.min(width - half, Math.max(half, ((anchor.x + 1) / 2) * width));
      const y = Math.max(label.offsetHeight + 6, ((1 - anchor.y) / 2) * height);
      label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      label.classList.toggle('is-active', t > 0.02 && ACTOR[chapter] === who);
    }
  }

  let target = 0;
  let current = 0;
  let paused = false;
  let clock = 0;
  let raf = 0;
  let running = false;
  let last = 0;
  const frameTimes: number[] = [];

  function loop(now: number) {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    // Judge speed after a warm-up, on the median frame, so one load hitch is not fatal.
    if (last && frameTimes.length < 90) {
      frameTimes.push(now - last);
      if (frameTimes.length === 90) {
        const steady = frameTimes.slice(30).sort((a, b) => a - b);
        // 40 ms tolerates a 30 fps cap (e.g. iOS Low Power Mode) but catches real stutter.
        if (steady[Math.floor(steady.length / 2)] > 40) {
          onSlow();
          return;
        }
      }
    }
    last = now;
    if (paused) {
      current = target;
    } else {
      clock += dt;
      // Play toward the target: about 2.4 s per chapter, faster when jumping several.
      const gap = target - current;
      const step = Math.max(0.42, Math.abs(gap) * 1.8) * dt;
      current += Math.sign(gap) * Math.min(Math.abs(gap), step);
    }
    place(current, clock);
    placeLabels(current);
    renderer.render(scene, camera);
  }
  function play() {
    if (running) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  let onScreen = false;
  const resume = () => (onScreen && !document.hidden ? play() : stop());
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    resume();
  });
  visibility.observe(host);
  document.addEventListener('visibilitychange', resume);

  return {
    setProgress(t) {
      target = Math.min(STORY_CHAPTERS, Math.max(0, t));
    },
    setPaused(value) {
      paused = value;
    },
    setPalette,
    destroy() {
      stop();
      visibility.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', resume);
      for (const mesh of [flood, nodes, crowdBodies, crowdHeads, factoryBlocks, factoryStacks]) {
        mesh.dispose();
      }
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
