
const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');

const W = 400;
const H = 50;
canvas.width  = W;
canvas.height = H;

const FONT_SIZE = 36;
const FONT      = `${FONT_SIZE}px 'Courier New', Courier, monospace`;
const LINE_GAP  = FONT_SIZE * 1.15;
const LINES     = ['blinking screen'];

document.getElementById('blinking-screen-text').style.fontSize = FONT_SIZE + 'px';

// ── Offscreen canvas: white text, sampled once after fonts load ─
const off  = document.createElement('canvas');
off.width  = W;
off.height = H;
const octx = off.getContext('2d');

document.fonts.ready.then(() => {
  octx.clearRect(0, 0, W, H);
  octx.fillStyle    = '#fff';
  octx.font         = FONT;
  octx.textAlign    = 'left';
  octx.textBaseline = 'middle';
  const totalH = LINE_GAP * (LINES.length - 1);
  LINES.forEach((line, i) => {
    octx.fillText(line, 0, H / 2 - totalH / 2 + i * LINE_GAP);
  });

  const src = octx.getImageData(0, 0, W, H).data;

  // Output buffer — alpha initialized to 0 (transparent) for transparency
  const outImg = ctx.createImageData(W, H);
  const out    = outImg.data;

  // ── Draw helpers ──────────────────────────────────────────────
  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle    = '#fff';
    ctx.font         = FONT;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    const totalH = LINE_GAP * (LINES.length - 1);
    LINES.forEach((line, i) => {
      ctx.fillText(line, 0, H / 2 - totalH / 2 + i * LINE_GAP);
    });
  }

  function drawSplit(dx, dy) {
    // Clear output buffer (alpha = 0 for transparency)
    for (let i = 0; i < out.length; i += 4) {
      out[i] = out[i+1] = out[i+2] = out[i+3] = 0;
    }
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const oi  = (py * W + px) * 4;
        const rpx = px - dx, rpy = py - dy;
        const bpx = px + dx, bpy = py + dy;
        const r = (rpx >= 0 && rpx < W && rpy >= 0 && rpy < H) ? src[(rpy * W + rpx) * 4] : 0;
        const g = src[oi];
        const b = (bpx >= 0 && bpx < W && bpy >= 0 && bpy < H) ? src[(bpy * W + bpx) * 4] : 0;
        if (r | g | b) {
          out[oi    ] = r;
          out[oi + 1] = g;
          out[oi + 2] = b;
          out[oi + 3] = 255;  // Set alpha to opaque
        }
      }
    }
    ctx.putImageData(outImg, 0, 0);
  }

  // ── State machine: 'static' | 'pulse' ────────────────────────
  let state = 'static';

  const MAX_OFFSET = Math.round(FONT_SIZE * 0.15);
  const PULSE_MS   = 200;  // total RGB pulse duration (out + back)

  let pulseT    = 0;
  let nextPulse = randomMs(5000, 10000);

  function randomMs(lo, hi) { return lo + Math.random() * (hi - lo); }

  drawStatic();

  let prev = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(now - prev, 50);
    prev = now;

    if (state === 'static') {
      nextPulse -= dt;
      if (nextPulse <= 0) {
        state     = 'pulse';
        pulseT    = 0;
        nextPulse = randomMs(5000, 10000);
      } else {
        return; // static — nothing to redraw
      }
    }

    if (state === 'pulse') {
      pulseT += dt;
      if (pulseT >= PULSE_MS) {
        state = 'static';
        drawStatic();
        return;
      }
      const p      = pulseT / PULSE_MS;
      let factor   = 1 - Math.abs(p * 2 - 1);           // triangle 0→1→0
      factor       = factor * factor * (3 - 2 * factor); // smoothstep
      const dx     = Math.round(factor * MAX_OFFSET);
      const dy     = Math.round(factor * MAX_OFFSET * 0.5);
      drawSplit(dx, dy);
    }
  }

  requestAnimationFrame(frame);
});