// FILE: src/components/particleField.tsx
//
// The object on the landing page.
//
// One particle system, ten formations, driven by WHICH SECTION the reader is
// on rather than by a timeline. That distinction is what lets every header
// link stay honest: jump straight to a section and the object is already in
// the right state when you land, instead of replaying from the beginning
// while you wait.
//
// Four rules it is built on, each of them learned the hard way:
//
//  1. Every formation is a SOLID. Flat shapes — a page, a surface, three
//     sheets — have no silhouette, so however many points you spend they
//     read as a grey smudge.
//  2. Each shape HOLDS for most of its section and only transforms at the
//     end. Morphing continuously means the reader almost never sees a
//     finished object. The one exception is the last transition, where the
//     coming-apart IS the thing being shown, so it is given nearly the whole
//     section to happen in.
//  3. Nothing rotates by itself. On the wordmark especially: a spin turns
//     the logo past ninety degrees and you end up reading the back of it.
//  4. The wordmark is centred on the INK, not on the canvas and not on the
//     font's advance width. Advance width includes side bearings and differs
//     between the real face and the fallback, which is what left the logo
//     sitting off to one side.

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ParticleFieldProps {
  /** Section ids, in page order, that the object is bound to. */
  sectionIds: string[];
  /** Set true to fire the fly-through. */
  launching: boolean;
}

export const ParticleField: React.FC<ParticleFieldProps> = ({ sectionIds, launching }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const launchRef = useRef(false);

  useEffect(() => { launchRef.current = launching; }, [launching]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Measure the canvas itself, not the window. A vertical scrollbar makes
       window.innerWidth wider than the box the canvas is actually painted
       into, and the difference squashes the object off centre. */
    const vw = () => canvas.clientWidth || window.innerWidth;
    const vh = () => canvas.clientHeight || window.innerHeight;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) {
      canvas.style.display = 'none';
      return;
    }
    if (!renderer.getContext()) { canvas.style.display = 'none'; return; }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(vw(), vh(), false);

    const FOV = 46;
    const DIST = 10.2;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, vw() / vh(), 0.1, 120);
    camera.position.set(0, 0, DIST);

    const MOBILE = window.innerWidth < 900;
    const COUNT = MOBILE ? 20000 : 90000;

    const forms: Float32Array[] = [];
    const scatterDir = new Float32Array(COUNT * 3);
    const positions = new Float32Array(COUNT * 3);
    const accent = new Float32Array(COUNT);
    const sizes = new Float32Array(COUNT);
    const seeds = new Float32Array(COUNT);
    /* 1 for the handful of points that are STARS rather than dust. Everything
       about how a point is drawn hangs off this. */
    const bright = new Float32Array(COUNT);

    const seeded = (i: number) => {
      const x = Math.sin(i * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    /* Sample a set of geometries as one object, weighted by triangle AREA.
       Weighting by triangle count instead piles points onto the small
       triangles, which is what made a stack of bars of different heights
       look brightest where it should have looked thinnest. */
    const sampleParts = (parts: THREE.BufferGeometry[], out: Float32Array) => {
      const pool: number[] = [];
      const cum: number[] = [];
      let total = 0;
      for (const src of parts) {
        const geo = src.index ? src.toNonIndexed() : src;
        const p = geo.attributes.position.array as ArrayLike<number>;
        for (let t = 0; t + 8 < p.length; t += 9) {
          const ax = p[t], ay = p[t + 1], az = p[t + 2];
          const bx = p[t + 3], by = p[t + 4], bz = p[t + 5];
          const cx = p[t + 6], cy = p[t + 7], cz = p[t + 8];
          const ux = bx - ax, uy = by - ay, uz = bz - az;
          const vx = cx - ax, vy = cy - ay, vz = cz - az;
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          const area = 0.5 * Math.sqrt(nx * nx + ny * ny + nz * nz);
          if (!(area > 0)) continue;
          pool.push(ax, ay, az, bx, by, bz, cx, cy, cz);
          total += area;
          cum.push(total);
        }
        if (geo !== src) geo.dispose();
        src.dispose();
      }
      const n = cum.length;
      if (!n || !(total > 0)) return;
      for (let i = 0; i < COUNT; i++) {
        const r = seeded(i * 1.7 + 401) * total;
        let lo = 0, hi = n - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
        const t = lo * 9;
        let a = seeded(i + 411), b = seeded(i + 421);
        if (a + b > 1) { a = 1 - a; b = 1 - b; }
        const c = 1 - a - b;
        out[i * 3]     = pool[t]     * c + pool[t + 3] * a + pool[t + 6] * b;
        out[i * 3 + 1] = pool[t + 1] * c + pool[t + 4] * a + pool[t + 7] * b;
        out[i * 3 + 2] = pool[t + 2] * c + pool[t + 5] * a + pool[t + 8] * b;
      }
    };

    /* ---------------------------------------------------------------- */
    /* 0. THE WORDMARK                                                   */
    /*                                                                   */
    /* The approved logo, drawn to an offscreen canvas in Playfair and    */
    /* sampled wherever ink landed, so these are the real letterforms.    */
    /* The ink is walked in order, not picked at random: random picking   */
    /* clumps and leaves holes, which is what made the letters grainy.    */
    /* ---------------------------------------------------------------- */
    const buildWordmark = () => {
      const a = new Float32Array(COUNT * 3);
      const W = 1800, H = 460;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      if (!g) return a;
      g.fillStyle = '#fff';
      g.textBaseline = 'alphabetic';
      g.font = '500 230px "Playfair Display", Georgia, serif';

      const word = 'marginalia';
      const wide = g.measureText(word).width;
      const sq = 40;
      const x0 = (W - (wide + 16 + sq)) / 2;
      const base = H * 0.68;
      g.fillText(word, x0, base);
      const sx = x0 + wide + 16, sy = base - sq;
      g.fillRect(sx, sy, sq, sq);

      const data = g.getImageData(0, 0, W, H).data;
      const ink: number[] = [], sqInk: number[] = [];
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (data[(y * W + x) * 4 + 3] > 130) {
            const inSquare = x >= sx && x <= sx + sq && y >= sy && y <= sy + sq;
            (inSquare ? sqInk : ink).push(x, y);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (!ink.length) return a;

      /* Centre and size on the ink that actually landed. Whatever face the
         browser gave us, and wherever fillText decided to put it, the drawn
         letters end up dead centre at a known width. */
      const inkW = Math.max(1, maxX - minX);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const seenH = 2 * Math.tan((FOV * Math.PI) / 180 / 2) * DIST;
      const seenW = seenH * (vw() / vh());
      const target = Math.min(11.4, seenW * 0.84);
      const scale = target / inkW;

      const inkN = ink.length / 2, sqN = sqInk.length / 2;
      let wi = 0, si = 0;
      for (let i = 0; i < COUNT; i++) {
        const useSquare = sqN > 0 && i % 16 === 0;
        const pool = useSquare ? sqInk : ink;
        const k = useSquare ? (si++ % sqN) * 2 : (wi++ % inkN) * 2;
        accent[i] = useSquare ? 1 : 0;
        a[i * 3]     =  (pool[k]     - cx + (seeded(i + 331) - 0.5) * 1.9) * scale;
        a[i * 3 + 1] = -(pool[k + 1] - cy + (seeded(i + 341) - 0.5) * 1.9) * scale;
        a[i * 3 + 2] =  (seeded(i + 311) - 0.5) * 0.22;
      }
      return a;
    };

    forms.push(buildWordmark());

    /* 1. AN ICOSAHEDRON — twenty flat faces, so it holds an outline at any
          angle. The four ways into the site. */
    {
      const a = new Float32Array(COUNT * 3);
      sampleParts([new THREE.IcosahedronGeometry(2.75, 0)], a);
      forms.push(a);
    }

    /* 2. THE LEDGER — five columns, one per year of filed history, rising
          left to right. The plainest possible picture of accounts arriving. */
    {
      const a = new Float32Array(COUNT * 3);
      const parts: THREE.BufferGeometry[] = [];
      [1.5, 2.0, 2.4, 3.0, 3.5].forEach((h, i) => {
        const g = new THREE.BoxGeometry(0.98, h, 0.98);
        g.translate(-3.4 + i * 1.7, -1.95 + h / 2, 0);
        parts.push(g);
      });
      sampleParts(parts, a);
      forms.push(a);
    }

    /* 3. A TORUS KNOT — the one shape that looks like something being worked
          out. The forecast under construction. */
    {
      const a = new Float32Array(COUNT * 3);
      sampleParts([new THREE.TorusKnotGeometry(1.85, 0.59, 220, 32, 2, 3)], a);
      forms.push(a);
    }

    /* 4. AN HOURGLASS — wide, narrow, wide. Everything the company earned
          forced through one waist and coming out the other side as cash. */
    {
      const a = new Float32Array(COUNT * 3);
      const pts: THREE.Vector2[] = [];
      for (let k = 0; k <= 48; k++) {
        const y = -2.55 + (k / 48) * 5.1;
        const r = 0.30 + 1.85 * Math.pow(Math.abs(y / 2.55), 2.0);
        pts.push(new THREE.Vector2(r, y));
      }
      sampleParts([new THREE.LatheGeometry(pts, 90)], a);
      forms.push(a);
    }

    /* 5. THE SPIRE — every forecast year spread wide at the base, winding
          inward and upward until they meet at one point. A picture of
          discounting rather than a metaphor for it. */
    {
      const a = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const u = Math.pow(seeded(i + 201), 0.62);
        const r = 3.85 * Math.pow(1 - u, 1.55) + 0.05;
        const th = seeded(i + 211) * Math.PI * 2 + u * 7.2;
        a[i * 3]     = r * Math.cos(th);
        a[i * 3 + 1] = -2.45 + u * 5.35;
        a[i * 3 + 2] = r * Math.sin(th);
      }
      forms.push(a);
    }

    /* 6. AN ARMILLARY — three rings at three angles. The instrument for
          fixing a position from more than one bearing, which is what three
          valuation approaches are for. */
    {
      const a = new Float32Array(COUNT * 3);
      const rings = [
        { R: 2.85, ax: 0.0, ay: 0.0 },
        { R: 2.35, ax: 1.12, ay: 0.35 },
        { R: 1.85, ax: 0.55, ay: 1.25 },
      ];
      for (let i = 0; i < COUNT; i++) {
        const r = rings[i % 3];
        const th = seeded(i) * Math.PI * 2;
        const phi = seeded(i + 3) * Math.PI * 2;
        const tube = 0.11;
        const x = (r.R + tube * Math.cos(phi)) * Math.cos(th);
        const y = (r.R + tube * Math.cos(phi)) * Math.sin(th);
        const z = tube * Math.sin(phi);
        const cy = Math.cos(r.ay), sy2 = Math.sin(r.ay);
        const x1 = x * cy + z * sy2, z1 = -x * sy2 + z * cy;
        const cx = Math.cos(r.ax), sx2 = Math.sin(r.ax);
        const y1 = y * cx - z1 * sx2, z2 = y * sx2 + z1 * cx;
        a[i * 3] = x1; a[i * 3 + 1] = y1; a[i * 3 + 2] = z2;
      }
      forms.push(a);
    }

    /* 7. THE LATTICE — a block of cells with depth to it. A spreadsheet you
          can walk around, for the section about editing the model and taking
          the workbook away with you. */
    {
      const a = new Float32Array(COUNT * 3);
      const parts: THREE.BufferGeometry[] = [];
      for (let gx = 0; gx < 5; gx++) {
        for (let gy = 0; gy < 5; gy++) {
          for (let gz = 0; gz < 2; gz++) {
            const g = new THREE.BoxGeometry(0.46, 0.46, 0.46);
            g.translate((gx - 2) * 1.14, (gy - 2) * 1.14, (gz - 0.5) * 1.20);
            parts.push(g);
          }
        }
      }
      sampleParts(parts, a);
      forms.push(a);
    }

    /* 8. THREE SOLIDS — three separate bodies, because the section is about
          three separate things the site is being built to do. */
    {
      const a = new Float32Array(COUNT * 3);
      const g1 = new THREE.IcosahedronGeometry(1.62, 0); g1.translate(-2.55, 0.55, 0.45);
      const g2 = new THREE.OctahedronGeometry(1.38, 0);  g2.translate(0.45, -1.25, -0.55);
      const g3 = new THREE.DodecahedronGeometry(1.08, 0); g3.translate(2.72, 1.15, 0.20);
      sampleParts([g1, g2, g3], a);
      forms.push(a);
    }

    /* 9. AND THEN IT LETS GO. Held closer in than it used to be, so the
          coming-apart happens where the reader can still see it rather than
          off the edges of the screen in the first half second. */
    {
      const a = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const u = seeded(i + 21) * Math.PI * 2, v = Math.acos(2 * seeded(i + 31) - 1);
        const rad = 7.5 + seeded(i + 41) * 7.5;
        a[i * 3]     = rad * Math.sin(v) * Math.cos(u);
        a[i * 3 + 1] = rad * Math.sin(v) * Math.sin(u);
        a[i * 3 + 2] = rad * Math.cos(v);
      }
      forms.push(a);
    }

    const LAST = forms.length - 1;

    /*            hero  routes ledger fcast  cash  spire  arm   latt   trio  letgo */
    const tiltX = [0.00, 0.16,  0.10,  0.22,  0.12, 0.14,  0.30, 0.34,  0.20, 0.24];
    const spinY = [0.00, -0.42, 0.38,  -0.55, 0.30, -0.30, -0.38, 0.62, -0.34, 0.10];
    const offX  = [0.00, -2.70, 2.70,  -2.70, 2.70, -2.70, 2.70, -2.70, 2.70, 0.00];
    const offY  = [2.30, 0.00,  0.00,  0.00,  0.00, 0.00,  0.00, 0.00,  0.00, 0.00];
    const zoomAt = [1.00, 0.92, 0.86,  0.92,  0.90, 0.86,  0.94, 0.88,  0.92, 1.00];

    /* How long each shape holds before it starts becoming the next one, as a
       fraction of the gap between the two sections. High means the reader
       sees a finished object for most of the section. The last one is low on
       purpose: the dispersal is the point, so it gets nearly all the scroll. */
    const HOLDS  = [0.55, 0.58, 0.58,  0.58,  0.58, 0.58,  0.58, 0.58,  0.34, 0.50];

    /* WHY IT LOOKED LIKE PAPER AND NOT LIKE A SKY.
       Every point was the same size — between one and three pixels — so
       gl_PointCoord had no room to draw anything, every one rendered as a
       flat opaque chip, and ninety thousand of them stacked up into a grey
       slab. A night sky has an enormous dynamic range: a few big bright
       stars, a haze of faint ones, and nothing in the middle. So two
       populations now. About one point in fifty is a star, ten to twenty
       pixels across with a core, a halo and diffraction spikes; the rest is
       dust, smaller and dimmer than before, and its job is to give the body
       its shape rather than to be looked at. */
    for (let i = 0; i < COUNT; i++) {
      seeds[i] = seeded(i + 91);
      const g = seeded(i + 601);
      const isStar = g > 0.978;
      bright[i] = isStar ? 1 : 0;
      sizes[i] =
        0.014 + Math.pow(seeded(i + 81), 1.8) * 0.018 +
        (isStar ? 0.06 + Math.pow((g - 0.978) / 0.022, 1.5) * 0.24 : 0);
      const u = seeded(i + 51) * Math.PI * 2, v = Math.acos(2 * seeded(i + 61) - 1);
      scatterDir[i * 3]     = Math.sin(v) * Math.cos(u);
      scatterDir[i * 3 + 1] = Math.sin(v) * Math.sin(u);
      scatterDir[i * 3 + 2] = Math.cos(v);
      positions[i * 3]     = forms[0][i * 3]     + scatterDir[i * 3]     * 11;
      positions[i * 3 + 1] = forms[0][i * 3 + 1] + scatterDir[i * 3 + 1] * 11;
      positions[i * 3 + 2] = forms[0][i * 3 + 2] + scatterDir[i * 3 + 2] * 11;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('psize', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('accent', new THREE.BufferAttribute(accent, 1));
    geom.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    geom.setAttribute('bright', new THREE.BufferAttribute(bright, 1));

    /* The wordmark is drawn before the webfont is guaranteed to be there, so
       that the object is never missing on a slow connection. Once Playfair
       has actually arrived, it is drawn again in the real face. */
    if ((document as any).fonts && (document as any).fonts.ready) {
      (document as any).fonts.ready.then(() => {
        if (disposed) return;
        forms[0] = buildWordmark();
        geom.attributes.accent.needsUpdate = true;
      }).catch(() => {});
    }

    /* HOW A STAR IS DRAWN.
       One shader, shared by the object and by the sky behind it. A hard
       white centre, a long soft halo around it, and — on the bright ones
       only — the four-point diffraction cross that an eye reads instantly
       as a star and never reads as a speck. The sprite is allowed to run
       out past the edge of its own disc so the spikes have somewhere to go.
       Dust is drawn at a little over half the brightness of a star, which
       is what stops ninety thousand of them adding up to a grey wall. */
    const STAR_FRAGMENT = `
      varying vec3 vColor;
      varying float vFade;
      varying float vBright;
      uniform float uOpacity;
      void main() {
        vec2 q = (gl_PointCoord - vec2(0.5)) * 2.0;
        float d = length(q);
        if (d > 1.36) discard;
        float f = clamp(1.0 - d / 1.36, 0.0, 1.0);

        float halo = pow(f, 2.6);
        float core = pow(f, 16.0);

        float sx = exp(-abs(q.x) * 30.0) * exp(-abs(q.y) * 1.5);
        float sy = exp(-abs(q.y) * 30.0) * exp(-abs(q.x) * 1.5);
        float spikes = (sx + sy) * vBright * f;

        float a = (halo * 0.30 + core * 0.88 + spikes * 0.60)
                * vFade * uOpacity * mix(0.80, 1.0, vBright);
        vec3 c = vColor * (0.60 + core * 1.55 + spikes * 1.10);
        gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
      }
    `;

    /* Additive blending is what turns flakes into sparks. Drawn normally,
       overlapping points cover one another and read as torn paper; added
       together they build light where the body is dense, which is exactly
       where an object should look solid. */
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 1.0 },
        uScale: { value: vh() * 0.5 },
        uTime: { value: 0 },
        uAccent: { value: 1.0 },
      },
      vertexShader: `
        attribute float psize;
        attribute float accent;
        attribute float seed;
        attribute float bright;
        varying vec3 vColor;
        varying float vFade;
        varying float vBright;
        uniform float uScale;
        uniform float uTime;
        uniform float uAccent;
        void main() {
          /* The house grading is kept: cool at the base, cream through the
             body, the red reserved for the very top. */
          vec3 cool = vec3(0.560, 0.545, 0.510);
          vec3 warm = vec3(0.960, 0.945, 0.900);
          vec3 red  = vec3(0.800, 0.290, 0.255);
          float h = clamp((position.y + 3.0) / 6.2, 0.0, 1.0);
          vec3 base = mix(cool, warm, h);
          base = mix(base, red, smoothstep(0.70, 1.0, h) * 0.80);

          /* Real skies are not one colour. Each point is given its own
             temperature, and the stars carry more of it than the dust. */
          vec3 blueWhite = vec3(0.760, 0.840, 1.000);
          vec3 amber     = vec3(1.000, 0.860, 0.680);
          float t = fract(seed * 7.31);
          base = mix(base, mix(blueWhite, amber, t), 0.22 + bright * 0.26);

          vColor = mix(base, red, accent * uAccent);
          vBright = bright;

          /* Stars do not all pulse together, and the faint ones barely
             pulse at all. */
          float tw = 0.58 + 0.42 * sin(uTime * (0.7 + seed * 2.1) + seed * 61.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFade = clamp((mv.z + 21.0) / 16.0, 0.42, 1.0)
                * mix(0.93, tw, 0.22 + bright * 0.68);
          gl_PointSize = psize * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: STAR_FRAGMENT,
    });

    const group = new THREE.Group();
    group.add(new THREE.Points(geom, material));
    scene.add(group);

    /* ---------------------------------------------------------------- */
    /* THE SKY BEHIND IT                                                 */
    /*                                                                   */
    /* A second layer of points on a shell well outside the object, which */
    /* never morphs, never disperses and never flies through. It is the   */
    /* other half of the fix: with nothing behind it, the object read as   */
    /* a cloud of specks on a blank rectangle. With a sky behind it, the   */
    /* object reads as made of the same stuff as the night it is standing  */
    /* in. It drifts, very slowly — about one turn every twenty minutes,   */
    /* which is felt rather than seen — and it takes a quarter of the drag */
    /* the object takes, which is what gives the screen its depth.         */
    /* ---------------------------------------------------------------- */
    const SKY = MOBILE ? 900 : 2800;
    const skyPos = new Float32Array(SKY * 3);
    const skySize = new Float32Array(SKY);
    const skySeed = new Float32Array(SKY);
    const skyBright = new Float32Array(SKY);
    for (let i = 0; i < SKY; i++) {
      const u = seeded(i * 3.1 + 7) * Math.PI * 2;
      const v = Math.acos(2 * seeded(i * 3.1 + 17) - 1);
      const rad = 42 + seeded(i * 3.1 + 27) * 30;
      skyPos[i * 3]     = rad * Math.sin(v) * Math.cos(u);
      skyPos[i * 3 + 1] = rad * Math.sin(v) * Math.sin(u);
      skyPos[i * 3 + 2] = rad * Math.cos(v);
      const g = seeded(i * 3.1 + 37);
      skyBright[i] = g > 0.93 ? 1 : 0;
      skySize[i] = 0.26 + Math.pow(seeded(i * 3.1 + 47), 3.0) * 0.60 + (g > 0.93 ? 0.55 : 0);
      skySeed[i] = seeded(i * 3.1 + 57);
    }
    const skyGeom = new THREE.BufferGeometry();
    skyGeom.setAttribute('position', new THREE.BufferAttribute(skyPos, 3));
    skyGeom.setAttribute('psize', new THREE.BufferAttribute(skySize, 1));
    skyGeom.setAttribute('seed', new THREE.BufferAttribute(skySeed, 1));
    skyGeom.setAttribute('bright', new THREE.BufferAttribute(skyBright, 1));

    const skyMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uOpacity: { value: 1.0 },
        uScale: { value: vh() * 0.5 },
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float psize;
        attribute float seed;
        attribute float bright;
        varying vec3 vColor;
        varying float vFade;
        varying float vBright;
        uniform float uScale;
        uniform float uTime;
        void main() {
          vec3 white = vec3(0.930, 0.940, 0.980);
          vec3 blue  = vec3(0.680, 0.780, 1.000);
          vec3 amber = vec3(1.000, 0.840, 0.660);
          float t = fract(seed * 9.17);
          vColor = mix(mix(blue, white, smoothstep(0.0, 0.55, t)), amber, smoothstep(0.74, 1.0, t));
          vBright = bright;
          float tw = 0.50 + 0.50 * sin(uTime * (0.45 + seed * 1.6) + seed * 53.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFade = mix(0.52, 1.0, tw) * (0.44 + bright * 0.56);
          gl_PointSize = psize * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: STAR_FRAGMENT,
    });

    const skyGroup = new THREE.Group();
    skyGroup.add(new THREE.Points(skyGeom, skyMaterial));
    scene.add(skyGroup);

    const sectionPosition = () => {
      const focus = window.scrollY + window.innerHeight / 2;
      const centres: number[] = [];
      for (let i = 0; i < sectionIds.length; i++) {
        const el = document.getElementById(sectionIds[i]);
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        /* Every section is anchored at its middle EXCEPT the last one, which
           is anchored near its foot. Anchored at its middle, the object had
           finished dispersing halfway down a section built to be long enough
           to watch it in, and the second half sat empty. */
        const last = i === sectionIds.length - 1;
        centres.push(r.top + window.scrollY + (last ? r.height * 0.94 : r.height / 2));
      }
      if (focus <= centres[0]) return 0;
      if (focus >= centres[centres.length - 1]) return centres.length - 1;
      for (let j = 0; j < centres.length - 1; j++) {
        if (focus >= centres[j] && focus <= centres[j + 1]) {
          const span = centres[j + 1] - centres[j];
          return j + (span > 0 ? (focus - centres[j]) / span : 0);
        }
      }
      return 0;
    };

    let entry = 0, clock = 0, launchT = 0, raf = 0, skyDrift = 0;
    let rotX = tiltX[0], rotY = spinY[0], posX = offX[0], posY = offY[0], zoom = zoomAt[0];
    let dragX = 0, dragY = 0, dragging = false, lastX = 0, lastY = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      dragY += (e.clientX - lastX) * 0.005;
      dragX += (e.clientY - lastY) * 0.003;
      dragX = Math.max(-0.7, Math.min(0.7, dragX));
      lastX = e.clientX; lastY = e.clientY;
    };
    const onUp = () => { dragging = false; };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    const arr = geom.attributes.position.array as Float32Array;

    const frame = () => {
      clock += 0.016;
      skyDrift += 0.00008;
      skyMaterial.uniforms.uTime.value = clock;
      skyGroup.rotation.y = skyDrift + dragY * 0.22;
      skyGroup.rotation.x = dragX * 0.14;
      if (entry < 1) entry = Math.min(1, entry + (reduced ? 1 : 0.016));
      const ease = 1 - Math.pow(1 - entry, 3);

      // THE FLY-THROUGH: everything comes at the reader and past them.
      if (launchRef.current) {
        launchT = Math.min(1, launchT + 0.019);
        const L = launchT * launchT;
        for (let q = 0; q < COUNT; q++) {
          const q3 = q * 3;
          const kick = 0.7 + seeds[q] * 1.1;
          arr[q3]     += scatterDir[q3]     * L * 1.5 * kick;
          arr[q3 + 1] += scatterDir[q3 + 1] * L * 1.5 * kick;
          arr[q3 + 2] += (1.1 + seeds[q] * 1.6) * L * 2.6;
        }
        geom.attributes.position.needsUpdate = true;
        material.uniforms.uTime.value = clock;
        material.uniforms.uOpacity.value = Math.max(0, 1 - Math.pow(launchT, 3) * 1.15);
        camera.fov = FOV + launchT * 26;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
        return;
      }
      if (launchT > 0) {
        launchT = 0;
        camera.fov = FOV;
        camera.updateProjectionMatrix();
        for (let q = 0; q < COUNT; q++) {
          const q3 = q * 3;
          arr[q3]     = forms[0][q3]     + scatterDir[q3]     * 11;
          arr[q3 + 1] = forms[0][q3 + 1] + scatterDir[q3 + 1] * 11;
          arr[q3 + 2] = forms[0][q3 + 2] + scatterDir[q3 + 2] * 11;
        }
      }

      const sp = sectionPosition();
      const s0 = Math.min(sectionIds.length - 2, Math.floor(sp));
      const t = sp - s0;
      const f0 = Math.min(s0, LAST);
      const f1 = Math.min(s0 + 1, LAST);

      // each shape holds for most of its section, then comes apart
      const HOLD = HOLDS[Math.min(s0, HOLDS.length - 1)];
      const m = f0 === f1 ? 0 : t < HOLD ? 0 : (t - HOLD) / (1 - HOLD);
      const smooth = m * m * (3 - 2 * m);

      const A = forms[f0], B = forms[f1];

      /* Going into the dispersal there is no extra bulge — the destination
         IS the bulge — and the points are chased more slowly, so the object
         drifts apart over the whole section instead of snapping open. */
      const ending = f1 === LAST;
      const burst = ending ? 0 : Math.sin(smooth * Math.PI) * 2.15;
      const chase = ending ? 0.045 : 0.13;

      for (let k = 0; k < COUNT; k++) {
        const k3 = k * 3;
        const j = 0.55 + seeds[k] * 0.95;
        let tx = A[k3]     + (B[k3]     - A[k3])     * smooth + burst * scatterDir[k3]     * j;
        let ty = A[k3 + 1] + (B[k3 + 1] - A[k3 + 1]) * smooth + burst * scatterDir[k3 + 1] * j;
        let tz = A[k3 + 2] + (B[k3 + 2] - A[k3 + 2]) * smooth + burst * scatterDir[k3 + 2] * j;
        if (entry < 1) {
          tx += scatterDir[k3]     * 11 * (1 - ease);
          ty += scatterDir[k3 + 1] * 11 * (1 - ease);
          tz += scatterDir[k3 + 2] * 11 * (1 - ease);
        }
        arr[k3]     += (tx - arr[k3])     * chase;
        arr[k3 + 1] += (ty - arr[k3 + 1]) * chase;
        arr[k3 + 2] += (tz - arr[k3 + 2]) * chase;
      }
      geom.attributes.position.needsUpdate = true;

      material.uniforms.uTime.value = clock;
      /* Stay bright while it comes apart and only give out at the very end.
         Fading in step with the morph is what made the dispersal invisible:
         the points had gone dim before they had gone anywhere. */
      material.uniforms.uOpacity.value = ending ? 1 - Math.pow(smooth, 2.6) * 0.85 : 1;
      material.uniforms.uAccent.value = f0 === 0 ? 1 - smooth : 0;

      const eased = t * t * (3 - 2 * t);
      let wantX = tiltX[f0] + (tiltX[f1] - tiltX[f0]) * smooth + dragX;
      let wantY = spinY[f0] + (spinY[f1] - spinY[f0]) * smooth + dragY;
      // the wordmark is locked square to the camera: a logo seen from an
      // angle is not a logo, and a spin shows the back of the letters
      const lock = 1 - Math.min(1, Math.abs(sp) * 1.6);
      if (lock > 0) { wantX *= 1 - lock; wantY *= 1 - lock; }

      const wantP = MOBILE ? 0 : offX[s0] + (offX[s0 + 1] - offX[s0]) * eased;
      const wantQ = offY[s0] + (offY[s0 + 1] - offY[s0]) * eased;
      const wantZ = zoomAt[s0] + (zoomAt[s0 + 1] - zoomAt[s0]) * eased;

      rotX += (wantX - rotX) * 0.07;
      rotY += (wantY - rotY) * 0.07;
      posX += (wantP - posX) * 0.06;
      posY += (wantQ - posY) * 0.06;
      zoom += (wantZ - zoom) * 0.06;
      group.rotation.x = rotX;
      group.rotation.y = rotY;
      group.position.x = posX;
      group.position.y = posY;
      group.scale.setScalar(zoom);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };

    const onResize = () => {
      camera.aspect = vw() / vh();
      camera.updateProjectionMatrix();
      renderer.setSize(vw(), vh(), false);
      material.uniforms.uScale.value = vh() * 0.5;
      skyMaterial.uniforms.uScale.value = vh() * 0.5;
      forms[0] = buildWordmark();
      geom.attributes.accent.needsUpdate = true;
    };
    window.addEventListener('resize', onResize);
    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      geom.dispose();
      material.dispose();
      skyGeom.dispose();
      skyMaterial.dispose();
      renderer.dispose();
    };
  }, [sectionIds]);

  return (
    <canvas
      ref={canvasRef}
      /* w-full h-full is not decoration. A <canvas> is a replaced element:
         given inset-0 and no width it lays out at its INTRINSIC 300x150 and
         sits in the corner, and everything drawn into it is shrunk into that
         box. The size has to be stated. */
      className="fixed inset-0 w-full h-full z-[5] block cursor-grab active:cursor-grabbing"
      aria-hidden="true"
    />
  );
};

export default ParticleField;
