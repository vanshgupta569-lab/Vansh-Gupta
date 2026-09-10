// FILE: src/components/particleField.tsx
//
// The object on the landing page.
//
// One particle system, six formations, driven by WHICH SECTION the reader is
// on rather than by a timeline. That distinction is what lets every header
// link stay honest: jump straight to a section and the object is already in
// the right state when you land, instead of replaying from the beginning
// while you wait.
//
// Three rules it is built on, each of them learned the hard way:
//
//  1. Every formation is a SOLID. Flat shapes — a page, a surface, three
//     sheets — have no silhouette, so however many points you spend they
//     read as a grey smudge.
//  2. Each shape HOLDS for most of its section and only transforms at the
//     end. Morphing continuously means the reader almost never sees a
//     finished object.
//  3. Nothing rotates by itself. On the wordmark especially: a spin turns
//     the logo past ninety degrees and you end up reading the back of it.

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

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) {
      canvas.style.display = 'none';
      return;
    }
    if (!renderer.getContext()) { canvas.style.display = 'none'; return; }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(0, 0, 10.2);

    const MOBILE = window.innerWidth < 900;
    const COUNT = MOBILE ? 20000 : 90000;

    const forms: Float32Array[] = [];
    const scatterDir = new Float32Array(COUNT * 3);
    const positions = new Float32Array(COUNT * 3);
    const accent = new Float32Array(COUNT);
    const sizes = new Float32Array(COUNT);
    const seeds = new Float32Array(COUNT);

    const seeded = (i: number) => {
      const x = Math.sin(i * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    const sampleSurface = (geometry: THREE.BufferGeometry, scale: number, out: Float32Array) => {
      const geo = geometry.index ? geometry.toNonIndexed() : geometry;
      const pos = geo.attributes.position.array as ArrayLike<number>;
      const tris = Math.floor(pos.length / 9);
      for (let i = 0; i < COUNT; i++) {
        const t = Math.floor(seeded(i * 1.7 + 401) * tris) * 9;
        let a = seeded(i + 411), b = seeded(i + 421);
        if (a + b > 1) { a = 1 - a; b = 1 - b; }
        const c = 1 - a - b;
        out[i * 3]     = (pos[t]     * c + pos[t + 3] * a + pos[t + 6] * b) * scale;
        out[i * 3 + 1] = (pos[t + 1] * c + pos[t + 4] * a + pos[t + 7] * b) * scale;
        out[i * 3 + 2] = (pos[t + 2] * c + pos[t + 5] * a + pos[t + 8] * b) * scale;
      }
    };

    /* 0. THE WORDMARK — the approved logo, drawn to an offscreen canvas in
          Playfair and sampled wherever ink landed, so these are the real
          letterforms rather than an approximation. The ink is walked in
          order, not picked at random: random picking clumps and leaves
          holes, which is what made the letters look grainy. */
    const buildWordmark = () => {
      const a = new Float32Array(COUNT * 3);
      const W = 1600, H = 420;
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
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (data[(y * W + x) * 4 + 3] > 130) {
            const inSquare = x >= sx && x <= sx + sq && y >= sy && y <= sy + sq;
            (inSquare ? sqInk : ink).push(x, y);
          }
        }
      }
      if (!ink.length) return a;

      const scale = 9.6 / W;
      const inkN = ink.length / 2, sqN = sqInk.length / 2;
      let wi = 0, si = 0;
      for (let i = 0; i < COUNT; i++) {
        const useSquare = sqN > 0 && i % 16 === 0;
        const pool = useSquare ? sqInk : ink;
        const k = useSquare ? (si++ % sqN) * 2 : (wi++ % inkN) * 2;
        accent[i] = useSquare ? 1 : 0;
        a[i * 3]     = (pool[k]     - W / 2 + (seeded(i + 331) - 0.5) * 1.9) * scale;
        a[i * 3 + 1] = -(pool[k + 1] - H / 2 + (seeded(i + 341) - 0.5) * 1.9) * scale;
        a[i * 3 + 2] = (seeded(i + 311) - 0.5) * 0.22;
      }
      return a;
    };

    forms.push(buildWordmark());

    // 1. an icosahedron: twenty flat faces, so it holds an outline at any angle
    {
      const a = new Float32Array(COUNT * 3);
      sampleSurface(new THREE.IcosahedronGeometry(1, 0), 2.75, a);
      forms.push(a);
    }

    // 2. a torus knot: the one shape that looks like something being worked out
    {
      const a = new Float32Array(COUNT * 3);
      sampleSurface(new THREE.TorusKnotGeometry(1, 0.32, 220, 32, 2, 3), 1.85, a);
      forms.push(a);
    }

    /* 3. THE SPIRE — every forecast year spread wide at the base, winding
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

    /* 4. AN ARMILLARY — three rings at three angles. The instrument for
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

    // 5. and then it lets go
    {
      const a = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const u = seeded(i + 21) * Math.PI * 2, v = Math.acos(2 * seeded(i + 31) - 1);
        const rad = 13 + seeded(i + 41) * 9;
        a[i * 3]     = rad * Math.sin(v) * Math.cos(u);
        a[i * 3 + 1] = rad * Math.sin(v) * Math.sin(u);
        a[i * 3 + 2] = rad * Math.cos(v);
      }
      forms.push(a);
    }

    const tiltX = [0.0, 0.16, 0.22, 0.14, 0.30, 0.24];
    const spinY = [0.0, -0.42, -0.55, -0.30, -0.38, 0.10];
    const sectionForm = [0, 1, 2, 3, 4, 5];
    const offX = [0.0, -2.7, 2.7, -2.7, 2.7, 0.0];
    const offY = [2.40, 0.0, 0.0, 0.0, 0.0, 0.0];
    const zoomAt = [1.0, 0.92, 0.92, 0.86, 0.94, 1.0];

    for (let i = 0; i < COUNT; i++) {
      seeds[i] = seeded(i + 91);
      sizes[i] = 0.017 + Math.pow(seeded(i + 81), 1.7) * 0.019;
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
        uScale: { value: window.innerHeight * 0.5 },
        uTime: { value: 0 },
        uAccent: { value: 1.0 },
      },
      vertexShader: `
        attribute float psize;
        attribute float accent;
        attribute float seed;
        varying vec3 vColor;
        varying float vFade;
        uniform float uScale;
        uniform float uTime;
        uniform float uAccent;
        void main() {
          vec3 cool = vec3(0.560, 0.545, 0.510);
          vec3 warm = vec3(0.960, 0.945, 0.900);
          vec3 red  = vec3(0.800, 0.290, 0.255);
          float h = clamp((position.y + 3.0) / 6.2, 0.0, 1.0);
          vec3 base = mix(cool, warm, h);
          base = mix(base, red, smoothstep(0.70, 1.0, h) * 0.80);
          vColor = mix(base, red, accent * uAccent);
          float twinkle = 0.88 + 0.12 * sin(uTime * 1.5 + seed * 43.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFade = clamp((mv.z + 21.0) / 16.0, 0.46, 1.0) * twinkle;
          gl_PointSize = psize * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vFade;
        uniform float uOpacity;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r2 = dot(d, d);
          if (r2 > 0.25) discard;
          float core = smoothstep(0.25, 0.0, r2);
          float glow = pow(core, 3.0);
          gl_FragColor = vec4(vColor * (0.72 + glow * 1.05), (core * 0.52 + glow * 0.48) * vFade * uOpacity);
        }
      `,
    });

    const group = new THREE.Group();
    group.add(new THREE.Points(geom, material));
    scene.add(group);

    const sectionPosition = () => {
      const focus = window.scrollY + window.innerHeight / 2;
      const centres: number[] = [];
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) return 0;
        const r = el.getBoundingClientRect();
        centres.push(r.top + window.scrollY + r.height / 2);
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

    let entry = 0, clock = 0, launchT = 0, raf = 0;
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
        camera.fov = 46 + launchT * 26;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
        return;
      }
      if (launchT > 0) {
        launchT = 0;
        camera.fov = 46;
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
      const f0 = sectionForm[Math.min(s0, sectionForm.length - 1)];
      const f1 = sectionForm[Math.min(s0 + 1, sectionForm.length - 1)];

      // each shape holds for most of its section, then comes apart
      const HOLD = 0.58;
      const m = f0 === f1 ? 0 : t < HOLD ? 0 : (t - HOLD) / (1 - HOLD);
      const smooth = m * m * (3 - 2 * m);

      const A = forms[f0], B = forms[f1];
      const burst = Math.sin(smooth * Math.PI) * 2.15;

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
        arr[k3]     += (tx - arr[k3])     * 0.13;
        arr[k3 + 1] += (ty - arr[k3 + 1]) * 0.13;
        arr[k3 + 2] += (tz - arr[k3 + 2]) * 0.13;
      }
      geom.attributes.position.needsUpdate = true;

      material.uniforms.uTime.value = clock;
      material.uniforms.uOpacity.value = f1 === forms.length - 1 ? 1 - smooth * 0.92 : 1;
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
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      material.uniforms.uScale.value = window.innerHeight * 0.5;
    };
    window.addEventListener('resize', onResize);
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      geom.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [sectionIds]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[5] block cursor-grab active:cursor-grabbing"
      aria-hidden="true"
    />
  );
};

export default ParticleField;
