(() => {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

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
  }

  window.addEventListener("resize", resize);
  resize();

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const center = { x: () => w * 0.5, y: () => h * 0.5 };
  const tilt = 2;
  const ringR = () => Math.min(w, h) * 1.0;
  const horizonR = () => ringR() * 0.025;
  const camZ = () => ringR() * 1.6;
  const fov = 1000;

  const chars = "0123456789*#";
  const maxParts = 5500;
  const spawnPerSec = 1000;
  const baseSize = 5;

  const ringAngular = 0.65;
  const inwardRate = 1.18;
  const swirlBoostNear = 5;
  const jitter = 0;

  const fadeAlpha = 0.22; // 0..1. lower => longer trails

  let stars = [];
  function makeStars() {
    const n = Math.floor((w * h) / 5200);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      a: Math.random() * 0.16
    }));
  }
  makeStars();
  window.addEventListener("resize", makeStars);

  function drawStars() {
    for (const s of stars) {
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.fillRect(s.x, s.y, 1, 1);
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
    return { sx: center.x() + x3 * s, sy: center.y() + y3 * s, s, z: zc };
  }

  const parts = [];
  const pool = [];

  function spawn() {
    const p = pool.pop() || {};
    const R = ringR();

    p.theta = Math.random() * Math.PI * 2;
    p.rad = R * (0.92 + Math.random() * 0.10);
    p.z = (Math.random() * 2 - 1) * jitter * (R * 0.06);
    p.ch = chars[(Math.random() * chars.length) | 0];

    p.size = baseSize + Math.random() * 10;
    p.age = 0;
    p.life = 3.2 + Math.random() * 2.4;

    p.prev = null;
    parts.push(p);
  }

  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
    ctx.fillRect(0, 0, w, h);
    drawStars();

    if (!reduceMotion) {
      const want = spawnPerSec * dt;
      const k = Math.floor(want) + (Math.random() < (want - Math.floor(want)) ? 1 : 0);
      for (let i = 0; i < k; i++) if (parts.length < maxParts) spawn();
    }

    const R = ringR();
    const H = horizonR();
    const drawn = [];

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
      const alpha = 0.10 + depth * 0.90;

      drawn.push({ p, pr, alpha, depth });
    }

    drawn.sort((a, b) => b.pr.z - a.pr.z);

    for (const it of drawn) {
      const { p, pr, alpha, depth } = it;

      if (p.prev) {
        const dx = pr.sx - p.prev.sx;
        const dy = pr.sy - p.prev.sy;
        const sp = Math.hypot(dx, dy);
        const a = Math.min(1, sp / 22) * alpha * 0.55;

        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = Math.max(0.8, 1.2 + depth * 1.2);
        ctx.beginPath();
        ctx.moveTo(p.prev.sx, p.prev.sy);
        ctx.lineTo(pr.sx, pr.sy);
        ctx.stroke();
      }

      const size = p.size * (0.80 + depth * 1.35);
      ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`;
      ctx.shadowBlur = depth > 0.75 ? 12 : 0;
      ctx.shadowColor = "rgba(255,255,255,0.35)";
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillText(p.ch, pr.sx, pr.sy);
      ctx.shadowBlur = 0;

      p.prev = { sx: pr.sx, sy: pr.sy };
    }

    const holePx = H * (fov / (fov + camZ())) * 1.9;

    ctx.save();
    ctx.translate(center.x(), center.y());
    ctx.scale(1, Math.cos(tilt));
    ctx.beginPath();
    ctx.arc(0, 0, R * (fov / (fov + camZ())) * 0.92, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(center.x(), center.y(), holePx, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.985)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(center.x(), center.y(), holePx * 1.35, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 1;
    ctx.stroke();

    requestAnimationFrame(frame);
  }

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, w, h);
  requestAnimationFrame(frame);
})();
