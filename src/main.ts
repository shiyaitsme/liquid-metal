import { fragmentSource, vertexSource, MAX_RIPPLES } from "./shader";

type Material = {
  tint: [number, number, number];
  tint2: [number, number, number];
  irid: number;
  dark: number;
  gloss: number;
};

const MATERIALS: Material[] = [
  { tint: [0.78, 0.84, 0.95], tint2: [1.0, 1.0, 1.0], irid: 0.0, dark: 0.0, gloss: 1.0 },
  { tint: [1.0, 0.97, 0.96], tint2: [1.0, 1.0, 1.0], irid: 0.85, dark: 0.0, gloss: 0.7 },
  { tint: [0.95, 0.62, 0.26], tint2: [1.0, 0.88, 0.62], irid: 0.0, dark: 0.15, gloss: 0.9 },
  { tint: [0.28, 0.36, 0.55], tint2: [0.75, 0.85, 1.0], irid: 0.2, dark: 0.95, gloss: 1.6 },
];

const canvas = document.querySelector<HTMLCanvasElement>("#gl")!;
const fallback = document.querySelector<HTMLElement>("#fallback")!;
const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-material]")];

const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });

if (!gl) {
  fallback.hidden = false;
} else {
  start(gl);
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
}

function start(gl: WebGL2RenderingContext) {
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
  }
  gl.useProgram(program);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(program, name);
  const uRes = u("uRes");
  const uTime = u("uTime");
  const uMouse = u("uMouse");
  const uPress = u("uPress");
  const uRipples = u("uRipples[0]");
  const uTint = u("uTint");
  const uTint2 = u("uTint2");
  const uIrid = u("uIrid");
  const uDark = u("uDark");
  const uGloss = u("uGloss");

  const ripples = new Float32Array(MAX_RIPPLES * 3).fill(0);
  for (let i = 0; i < MAX_RIPPLES; i++) ripples[i * 3 + 2] = -100;
  let rippleIndex = 0;

  const current: Material = structuredClone(MATERIALS[0]);
  let target = MATERIALS[0];

  const mouse = { x: 0, y: 0, tx: 0, ty: 0, press: 0, down: false };
  let width = 1;
  let height = 1;

  const toScene = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = rect.height - (clientY - rect.top);
    return [(px * 2 - rect.width) / rect.height, (py * 2 - rect.height) / rect.height] as const;
  };

  const addRipple = (x: number, y: number, time: number) => {
    ripples[rippleIndex * 3] = x;
    ripples[rippleIndex * 3 + 1] = y;
    ripples[rippleIndex * 3 + 2] = time;
    rippleIndex = (rippleIndex + 1) % MAX_RIPPLES;
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  };
  window.addEventListener("resize", resize);
  resize();

  const t0 = performance.now();
  const now = () => (performance.now() - t0) / 1000;

  const TRAIL_SPACING = 0.17;
  let trailLast: readonly [number, number] | null = null;

  const stampTrail = (x: number, y: number) => {
    if (!trailLast) {
      trailLast = [x, y];
      return;
    }
    const dx = x - trailLast[0];
    const dy = y - trailLast[1];
    const dist = Math.hypot(dx, dy);
    if (dist < TRAIL_SPACING) return;
    const steps = Math.min(Math.floor(dist / TRAIL_SPACING), MAX_RIPPLES);
    const t = now();
    for (let i = 1; i <= steps; i++) {
      const k = (i * TRAIL_SPACING) / dist;
      addRipple(trailLast[0] + dx * k, trailLast[1] + dy * k, t);
    }
    const k = (steps * TRAIL_SPACING) / dist;
    trailLast = [trailLast[0] + dx * k, trailLast[1] + dy * k];
  };

  canvas.addEventListener("pointermove", (e) => {
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) {
      const [x, y] = toScene(ev.clientX, ev.clientY);
      mouse.tx = x;
      mouse.ty = y;
      if (mouse.down) stampTrail(x, y);
    }
  });
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const [x, y] = toScene(e.clientX, e.clientY);
    mouse.tx = x;
    mouse.ty = y;
    mouse.down = true;
    trailLast = [x, y];
    addRipple(x, y, now());
  });
  const release = () => (mouse.down = false);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  const selectMaterial = (index: number) => {
    target = MATERIALS[index];
    buttons.forEach((b, i) => b.classList.toggle("active", i === index));
  };
  buttons.forEach((b) =>
    b.addEventListener("click", () => selectMaterial(Number(b.dataset.material))),
  );
  window.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= MATERIALS.length) selectMaterial(n - 1);
  });

  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const lerp3 = (a: number[], b: number[], k: number) => {
    for (let i = 0; i < 3; i++) a[i] = lerp(a[i], b[i], k);
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let last = now();

  const frame = () => {
    const t = now();
    const dt = Math.min(t - last, 0.05);
    last = t;

    const follow = 1 - Math.exp(-dt * 9);
    mouse.x = lerp(mouse.x, mouse.tx, follow);
    mouse.y = lerp(mouse.y, mouse.ty, follow);
    mouse.press = lerp(mouse.press, mouse.down ? 1 : 0, 1 - Math.exp(-dt * 8));

    const k = 1 - Math.exp(-dt * 5);
    lerp3(current.tint, target.tint, k);
    lerp3(current.tint2, target.tint2, k);
    current.irid = lerp(current.irid, target.irid, k);
    current.dark = lerp(current.dark, target.dark, k);
    current.gloss = lerp(current.gloss, target.gloss, k);

    gl.uniform2f(uRes, width, height);
    gl.uniform1f(uTime, reduceMotion ? t * 0.25 : t);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uPress, mouse.press);
    gl.uniform3fv(uRipples, ripples);
    gl.uniform3fv(uTint, current.tint);
    gl.uniform3fv(uTint2, current.tint2);
    gl.uniform1f(uIrid, current.irid);
    gl.uniform1f(uDark, current.dark);
    gl.uniform1f(uGloss, current.gloss);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  };

  addRipple(0, 0, 0.2);
  requestAnimationFrame(frame);
}
