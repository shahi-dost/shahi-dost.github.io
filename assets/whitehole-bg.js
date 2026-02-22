(() => {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  const starCanvas = document.createElement("canvas");
  const starCtx = starCanvas.getContext("2d", { alpha: true });

  let w = 0, h = 0, dpr = 1;

  const reduceMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    dpr = Math.max(1, Math.floor(devicePixelRatio || 1));
    w = innerWidth;
    h = innerHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    starCanvas.width = w * dpr;
    starCanvas.height = h * dpr;
    starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildStars();
  }
  addEventListener("resize", resize);

  const cx = () => w * 0.75;
  const cy = () => h * 0.65;

  const tilt = -0.75;

  const ringR = () => Math.min(w, h) * 20;
  const horizonR = () => ringR() * 0.075;
  const camZ = () => ringR() * 0.96;
  const fov = 1200;

  const ringAngular = .75;
  const swirlBoostNear = 2;;
  const inwardRateInner = 0.35;
  const inwardRateOuter = 0.2;

  const omegaOuterMult = 0.28;
  let globalHue = 0; // Tracks the rainbow position
  const thickness = 0.75;

  const fontFamily =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  const glyphRGB = "220,220,220";
  const baseSize = 8;
  const minAlpha = 0.8;
  const maxAlpha = 1.0;

  const ringChars = "01";
  const maxRingParts = 4000;
  const ringSpawnPerSec = reduceMotion ? 0 : 200;

  function buildStars() {
    starCtx.clearRect(0, 0, w, h);
    starCtx.fillStyle = "black";
    starCtx.fillRect(0, 0, w, h);

    const n = Math.floor((w * h) / 5200);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const a = Math.random() * 0.16;
      starCtx.fillStyle = `rgba(255,255,255,${a})`;
      starCtx.fillRect(x, y, 1, 1);
    }
  }

  function rotateX(y, z, a) {
    const ca = Math.cos(a),
      sa = Math.sin(a);
    return { y: y * ca - z * sa, z: y * sa + z * ca };
  }

  function project(x, y, z) {
    const yz = rotateX(y, z, tilt);
    const x3 = x;
    const y3 = yz.y;
    const z3 = yz.z;

    const zc = z3 + camZ();
    const s = fov / (fov + zc);

    return { sx: cx() + x3 * s, sy: cy() + y3 * s, s, z3 };
  }

  function screenToRingPlaneZ0(sx, sy) {
    const dx = sx - cx();
    const dy = sy - cy();

    const c = Math.cos(tilt);
    const s = Math.sin(tilt);

    const denom = c * fov - dy * s;
    const y = Math.abs(denom) < 1e-6 ? 0 : (dy * (fov + camZ())) / denom;

    const z3 = y * s;
    const scale = fov / (fov + camZ() + z3);
    const x = dx / scale;

    return { x, y };
  }

  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  function updateSpiral(p, dt, R, H) {
    // k is the expansion rate. 
    // We use inwardRateOuter for a consistent outward push.
    const k = inwardRateOuter; 
    
    // REVERSE: Instead of shrinking, we grow the radius
    p.rad *= (1 + k * dt);

    // Speed logic: Particles spin faster near the center and slow down as they exit
    const u = clamp01(1 - (p.rad - H) / (R - H));
    const baseOmega = ringAngular;
    const omega = baseOmega * (0.5 + u * swirlBoostNear);
    p.theta += omega * dt;
  }

  const ringParts = [];
  const ringPool = [];

function spawnRing() {
    const p = ringPool.pop() || {};
    const H = horizonR();

    p.theta = Math.random() * Math.PI * 2;
    p.rad = H * (1.1 + Math.random() * 0.2); 
    p.z = (Math.random() * 2 - 1) * thickness * (H * 0.5);

    p.ch = ringChars[(Math.random() * ringChars.length) | 0];
    p.size = baseSize + Math.random() * 10;

    // RAINBOW LOGIC: Assign HSL color
    p.color = `hsl(${Math.floor(globalHue / 10) * 10}, 80%, 70%)`;
    // SLOW DOWN THE CHANGE: 
    // Lowering this number makes each color (red, orange, etc.) last longer.
    globalHue = (globalHue + 0.05) % 360; 

    ringParts.push(p);
  }
  let mx = 0.5,
    my = 0.5;
  addEventListener("pointermove", (e) => {
    mx = e.clientX;
    my = e.clientY;
  });

  let currentFontPx = -1;
  function setFont(px) {
    if (px !== currentFontPx) {
      currentFontPx = px;
      ctx.font = `${px}px ${fontFamily}`;
    }
  }

  let last = performance.now();
  let ringAcc = 0;

function drawBatch(arr, holePx, allowOverlap) {

  for (let i = 0; i < arr.length; i++) {
    const it = arr[i];
    const size = it.size * (0.86 + it.depth * 1.20);
    const px = (size + 0.5) | 0;
    if (px < 7) continue;

    const dxHole = it.sx - cx();
    const dyHole = it.sy - cy();
    const r2Hole = dxHole*dxHole + dyHole*dyHole;
    const glyphRadius = px * 0.55;
    const clipR = holePx - glyphRadius;

    if (clipR > 0 && r2Hole < clipR*clipR) {
      if (!allowOverlap) continue;
    }

    setFont(px);
    ctx.globalAlpha = it.alpha;
    ctx.fillStyle = it.color;
    ctx.shadowBlur = 0;
    
    ctx.fillText(it.ch, it.sx, it.sy);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0; // Reset for next batch
}
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    ctx.globalAlpha = 1;
    ctx.drawImage(starCanvas, 0, 0, w, h);

    const R = ringR();
    const H = horizonR();

    if (ringSpawnPerSec > 0) {
      ringAcc += dt;
      const want = ringSpawnPerSec * ringAcc;
      const k = Math.floor(want);
      if (k > 0) {
        ringAcc -= k / ringSpawnPerSec;
        for (let i = 0; i < k; i++) {
          if (ringParts.length < maxRingParts) spawnRing();
        }
      }
    }


    const back = [];
    const front = [];
for (let i = ringParts.length - 1; i >= 0; i--) {
      const p = ringParts[i];

      // REVERSE: Despawn if radius exceeds the outer ring (R)
      if (p.rad > R * 1.5) { 
        ringParts.splice(i, 1);
        ringPool.push(p);
        continue;
      }

      updateSpiral(p, dt, R, H);

      const x = Math.cos(p.theta) * p.rad;
      const y = Math.sin(p.theta) * p.rad;

      const pr = project(x, y, p.z);
      const depth = clamp01((pr.s - 0.2) / 0.95);
      const fade = clamp01((p.rad - H) / (R * 0.1));
      const alpha = (minAlpha + depth * (maxAlpha - minAlpha)) * fade;

      (pr.z3 > 0 ? back : front).push({
        ch: p.ch,
        size: p.size,
        depth,
        alpha,
        sx: pr.sx,
        sy: pr.sy,
        color: p.color // Pass the stored rainbow color here
      });
    }

    const holePx = H * (fov / (fov + camZ()));

    drawBatch(back, holePx, false);


    ctx.globalAlpha = 1;
    ctx.beginPath();
    // Top half: Strict circular arc to clip the back swirl cleanly
    ctx.arc(cx(), cy(), holePx, 0, Math.PI, true);
    // Bottom half: Elliptical arc matching the front swirl's 3D tilt
    ctx.ellipse(
      cx(), cy(), 
      holePx, holePx * Math.abs(Math.cos(tilt)), 
      0, Math.PI, 0, true
    );
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.fill();



    drawBatch(front, holePx, true);

    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();