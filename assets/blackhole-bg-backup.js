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

  const ringAngular = 0.45;
  const swirlBoostNear = 2.5;
  const inwardRateInner = 0.35;
  const inwardRateOuter = 0.75;

  const omegaOuterMult = 0.28;

  const thickness = 0.75;

  const fontFamily =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  const glyphRGB = "220,220,220";
  const mouseGlyphRGB = "255,80,80";
  const baseSize = 8;
  const minAlpha = 0.8;
  const maxAlpha = 1.0;

  const ringChars = "01234567890123456789";
  const maxRingParts = 4000;
  const ringSpawnPerSec = reduceMotion ? 0 : 420;

  const mouseChars = "01";
  const mouseIntervalMs = 50;
  const mouseMaxParts = 650;
  const mouseOffsetY = 0;

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
    const isOuter = p.rad > R;

    const k = isOuter ? inwardRateOuter : inwardRateInner;
    p.rad *= 1 - k * dt;

    const u = clamp01(1 - (p.rad - H) / (R - H));
    const baseOmega = ringAngular * (isOuter ? omegaOuterMult : 1);
    const omega = baseOmega * (1 + u * u * swirlBoostNear);
    p.theta += omega * dt;
  }

  const ringParts = [];
  const ringPool = [];
  const mouseParts = [];
  const mousePool = [];

  function spawnRing() {
    const p = ringPool.pop() || {};
    const R = ringR();

    p.theta = Math.random() * Math.PI * 2;
    p.rad = R * (0.92 + Math.random() * 0.1);
    p.z = (Math.random() * 2 - 1) * thickness * (R * 0.06);

    p.ch = ringChars[(Math.random() * ringChars.length) | 0];
    p.size = baseSize + Math.random() * 10;

    ringParts.push(p);
  }

  let mx = 0.5,
    my = 0.5;
  addEventListener("pointermove", (e) => {
    mx = e.clientX;
    my = e.clientY;
  });

  function spawnMouse() {
    if (reduceMotion) return;

    let p;
    if (mouseParts.length >= mouseMaxParts) {
      p = mouseParts.shift();
    } else {
      p = mousePool.pop() || {};
    }

    const sx = mx;
    const sy = my + mouseOffsetY;

    const H = horizonR();

    const rp = screenToRingPlaneZ0(sx, sy);
    const theta = Math.atan2(rp.y, rp.x);
    let rad = Math.hypot(rp.x, rp.y);

    rad = Math.max(H * 1.15, rad);

    p.theta = theta;
    p.rad = rad;
    p.z = 0;

    p.ch = mouseChars[(Math.random() * mouseChars.length) | 0];
    p.size = baseSize + Math.random() * 10;

    mouseParts.push(p);
  }

  let currentFontPx = -1;
  function setFont(px) {
    if (px !== currentFontPx) {
      currentFontPx = px;
      ctx.font = `${px}px ${fontFamily}`;
    }
  }

  let last = performance.now();
  let ringAcc = 0;
  let mouseAcc = 0;

function drawBatch(arr, holePx, allowOverlap) {
  ctx.fillStyle = `rgb(${glyphRGB})`;

  for (let i = 0; i < arr.length; i++) {
    const it = arr[i];

    const size = it.size * (0.86 + it.depth * 1.20);
    const px = (size + 0.5) | 0;
    if (px < 7) continue;

    const dx = it.sx - cx();
    const dy = it.sy - cy();
    const r2 = dx*dx + dy*dy;

    // clip radius adjusted by glyph size (prevents "see-through" edges)
    const glyphRadius = px * 0.55;
    const clipR = holePx - glyphRadius;

    // If inside the hole, only draw when overlap is allowed (front/bottom side)
    if (clipR > 0 && r2 < clipR*clipR) {
      if (!allowOverlap) continue;
    }

    setFont(px);
    ctx.globalAlpha = it.alpha;
    ctx.fillStyle = it.isMouse ? `rgb(${mouseGlyphRGB})` : `rgb(${glyphRGB})`;
    ctx.fillText(it.ch, it.sx, it.sy);
  }

  ctx.globalAlpha = 1;
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

    mouseAcc += dt * 1000;
    while (mouseAcc >= mouseIntervalMs) {
      mouseAcc -= mouseIntervalMs;
      spawnMouse();
    }

    const back = [];
    const front = [];

    for (let i = ringParts.length - 1; i >= 0; i--) {
      const p = ringParts[i];

      if (p.rad < H) {
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
      });
    }

    for (let i = mouseParts.length - 1; i >= 0; i--) {
      const p = mouseParts[i];

      if (p.rad < H) {
        mouseParts.splice(i, 1);
        mousePool.push(p);
        continue;
      }

      updateSpiral(p, dt, R, H);

      const x = Math.cos(p.theta) * p.rad;
      const y = Math.sin(p.theta) * p.rad;

      const pr = project(x, y, p.z);
      const depth = clamp01((pr.s - 0.2) / 0.95);
      const fadeNearHole = clamp01((p.rad - H) / (R * 0.1));
      const alpha =
        (minAlpha + depth * (maxAlpha - minAlpha)) * fadeNearHole;

      (pr.z3 > 0 ? back : front).push({
        ch: p.ch,
        size: p.size,
        depth,
        alpha,
        sx: pr.sx,
        sy: pr.sy,
        isMouse: true
      });
    }
    const holePx = H * (fov / (fov + camZ())) * 1.9;

    drawBatch(back, holePx, false);


    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx(), cy(), holePx, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.fill();

    drawBatch(front, holePx, true);

    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();