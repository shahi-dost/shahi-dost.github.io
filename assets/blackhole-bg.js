(() => {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  const starCanvas = document.createElement("canvas");
  const starCtx = starCanvas.getContext("2d", { alpha: true });

  let w = 0, h = 0, dpr = 1;

  function resize() {
    dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    w = window.innerWidth;
    h = window.innerHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    starCanvas.width = w * dpr;
    starCanvas.height = h * dpr;
    starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildStars();
  }
  window.addEventListener("resize", resize);

  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cx = () => w * 0.5;
  const cy = () => h * 0.5;

  const tilt = -0.95;

  const ringR = () => Math.min(w, h) * 10;
  const horizonR = () => ringR() * 0.15;
  const camZ = () => ringR() * 0.96;
  const fov = 900;

  const chars = "01234567890123456789";

  const maxParts = 2000;
  const spawnPerSec = reduceMotion ? 0 : 520;

  const ringAngular = 0.45;
  const inwardRate = 0.25;
  const swirlBoostNear = 1.5;
  const thickness = 0.80;

  const baseSize = 10;
  const minAlpha = 0.80;
  const maxAlpha = 1.00;
  const fontFamily =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';
  const glyphRGB = "220,220,220";

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
    const ca = Math.cos(a), sa = Math.sin(a);
    return { y: y * ca - z * sa, z: y * sa + z * ca };
  }

  function project(x, y, z) {
    const yz = rotateX(y, z, tilt);
    const x3 = x;
    const y3 = yz.y;
    const z3 = yz.z;

    const zc = z3 + camZ();
    const s = fov / (fov + zc);

    return { sx: cx() + x3 * s, sy: cy() + y3 * s, s, zc, z3 };
  }

  const parts = [];
  const pool = [];

  function spawn() {
    const p = pool.pop() || {};
    const R = ringR();

    p.theta = Math.random() * Math.PI * 2;
    p.rad = R * (0.92 + Math.random() * 0.10);
    p.z = (Math.random() * 2 - 1) * thickness * (R * 0.06);
    p.ch = chars[(Math.random() * chars.length) | 0];

    p.size = baseSize + Math.random() * 10;
    p.age = 0;
    p.life = 3.2 + Math.random() * 2.4;

    parts.push(p);
  }

  let last = performance.now();
  let currentFontPx = -1;

  function setFont(px) {
    if (px !== currentFontPx) {
      currentFontPx = px;
      ctx.font = `${px}px ${fontFamily}`;
    }
  }

  function drawBatch(arr) {
    ctx.fillStyle = `rgb(${glyphRGB})`;

    for (let i = 0; i < arr.length; i++) {
      const { p, pr, alpha, depth } = arr[i];

      const size = p.size * (0.86 + depth * 1.20);
      const px = (size + 0.5) | 0;
      if (px < 6) continue;

      setFont(px);
      ctx.globalAlpha = alpha;
      ctx.fillText(p.ch, pr.sx, pr.sy);
    }

    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    ctx.globalAlpha = 1;
    ctx.drawImage(starCanvas, 0, 0, w, h);

    if (spawnPerSec > 0) {
      const want = spawnPerSec * dt;
      const k = Math.floor(want) + (Math.random() < (want - Math.floor(want)) ? 1 : 0);
      for (let i = 0; i < k; i++) if (parts.length < maxParts) spawn();
    }

    const R = ringR();
    const H = horizonR();

    const back = [];
    const front = [];

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;

      if (p.age > p.life || p.rad < H) {
        parts.splice(i, 1);
        pool.push(p);
        continue;
      }

      p.rad *= (1 - inwardRate * dt);

      const t = 1 - (p.rad - H) / (R - H);
      const omega = ringAngular * (1 + t * t * swirlBoostNear);
      p.theta += omega * dt;

      const x = Math.cos(p.theta) * p.rad;
      const y = Math.sin(p.theta) * p.rad;

      const pr = project(x, y, p.z);

      const depth = Math.max(0, Math.min(1, (pr.s - 0.20) / 0.95));
      const fadeIn = Math.max(0, Math.min(1, (p.rad - H) / (R * 0.10)));
      const alpha = (minAlpha + depth * (maxAlpha - minAlpha)) * fadeIn;

      (pr.z3 > 0 ? back : front).push({ p, pr, alpha, depth });
    }

    drawBatch(back);

    const holePx = H * (fov / (fov + camZ())) * 1.9;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx(), cy(), holePx, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fill();

    drawBatch(front);

    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();
