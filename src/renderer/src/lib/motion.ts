import type { Motion } from '@shared/types'

const COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform float u_time;

const float TAU = 6.2831853;
const float PERIOD = 1200.0;

float turn(float cycles) {
  return TAU * cycles * u_time / PERIOD;
}

vec2 orbit(float radius) {
  return radius * vec2(cos(turn(1.0)), sin(turn(1.0)));
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}

float vignette(vec2 uv) {
  vec2 d = uv - vec2(0.5, 0.48);
  return 1.0 - smoothstep(0.35, 0.95, length(d * vec2(1.1, 1.3)));
}

vec3 dither(vec3 col) {
  return col + (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) / 255.0;
}
`

const SHADERS: Record<Motion, string> = {
  bokeh: `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  vec3 col = mix(vec3(0.045, 0.05, 0.10), vec3(0.085, 0.055, 0.06), uv.y);
  col += vec3(0.10, 0.06, 0.02) * (1.0 - uv.y) * 0.5;

  for (int i = 0; i < 28; i++) {
    float fi = float(i);
    float r = mix(0.035, 0.13, hash(vec2(fi, 1.3)));
    float rise = floor(mix(10.0, 26.0, hash(vec2(fi, 7.1))));
    float sway = 0.06 * sin(turn(floor(mix(6.0, 14.0, hash(vec2(fi, 4.4))))) + fi * 2.1);
    float x = hash(vec2(fi, 3.7)) * (aspect + 0.3) - 0.15 + sway;
    float y = fract(hash(vec2(fi, 9.2)) + rise * t / PERIOD) * (1.0 + 4.0 * r) - 2.0 * r;
    float d = length(p - vec2(x, y));
    float disk = smoothstep(r, r * 0.72, d);
    float rim = smoothstep(r, r * 0.9, d) * smoothstep(r * 0.7, r * 0.9, d);
    vec3 tint = hash(vec2(fi, 5.5)) > 0.72 ? vec3(0.55, 0.72, 1.0) : vec3(1.0, 0.7, 0.36);
    float pulse = 0.6 + 0.4 * sin(turn(floor(mix(60.0, 140.0, hash(vec2(fi, 2.2))))) + fi * 1.7);
    float near = 0.35 + 0.65 * hash(vec2(fi, 8.8));
    col += tint * (disk * 0.2 + rim * 0.09) * pulse * near;
  }

  col *= mix(0.55, 1.0, vignette(uv));
  gl_FragColor = vec4(dither(col), 1.0);
}`,

  waves: `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  float x = uv.x * aspect;

  vec3 col = mix(vec3(0.015, 0.03, 0.08), vec3(0.03, 0.08, 0.16), smoothstep(0.0, 0.6, uv.y));
  col = mix(col, vec3(0.012, 0.025, 0.06), smoothstep(0.6, 1.0, uv.y));

  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float y = 0.5
      + 0.11 * sin(x * 1.4 + turn(42.0) + fi * 1.9)
      + 0.05 * sin(x * 3.3 - turn(32.0) + fi * 0.7)
      + 0.025 * sin(x * 6.1 + turn(59.0) + fi * 2.6)
      + (fi - 2.0) * 0.045;
    float d = abs(uv.y - y);
    float glow = 0.006 / (d + 0.006) + 0.35 * exp(-d * 18.0);
    vec3 tint = mix(vec3(0.25, 0.5, 1.0), vec3(0.35, 0.95, 0.95), fi / 4.0);
    float fade = 0.55 + 0.45 * sin(x * 0.9 + turn(23.0) + fi);
    col += tint * glow * 0.1 * fade;
  }

  col += vec3(0.05, 0.08, 0.16) * fbm(vec2(x * 1.5, uv.y * 2.0) + orbit(3.0)) * 0.5;
  col *= mix(0.6, 1.0, vignette(uv));
  gl_FragColor = vec4(dither(col), 1.0);
}`,

  stars: `
vec3 layer(vec2 p, float scale, float seed) {
  vec2 q = p * scale;
  vec2 cell = floor(q);
  vec2 f = fract(q) - 0.5;
  float h = hash(cell + seed);
  if (h < 0.72) return vec3(0.0);
  vec2 at = vec2(hash(cell + seed + 1.3), hash(cell + seed + 7.7)) - 0.5;
  float d = length(f - at * 0.7);
  float size = mix(0.035, 0.09, hash(cell + seed + 3.1));
  float rate = floor(mix(115.0, 345.0, hash(cell + seed + 5.3)));
  float twinkle = 0.55 + 0.45 * sin(turn(rate) + h * 40.0);
  float star = smoothstep(size, 0.0, d) * twinkle;
  vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.9, 0.75), hash(cell + seed + 9.9));
  return tint * star;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  vec3 col = mix(vec3(0.045, 0.07, 0.16), vec3(0.012, 0.018, 0.05), uv.y);
  float cloud = fbm(p * 1.8 + orbit(1.2));
  float band = smoothstep(0.35, 0.85, cloud) * (0.6 + 0.4 * sin(p.x * 1.3 + 0.8));
  col += mix(vec3(0.18, 0.1, 0.32), vec3(0.08, 0.16, 0.35), uv.x) * band * 0.45;

  col += layer(p + orbit(0.5), 26.0, 1.0);
  col += layer(p + orbit(0.9), 14.0, 11.0) * 1.2;
  col += layer(p + orbit(1.4), 7.0, 23.0) * 1.4;

  col *= mix(0.7, 1.0, vignette(uv));
  gl_FragColor = vec4(dither(col), 1.0);
}`,

  clouds: `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  vec3 sky = mix(vec3(0.93, 0.96, 0.99), vec3(0.66, 0.8, 0.94), smoothstep(0.0, 1.0, uv.y));
  vec2 drift = orbit(4.0) * vec2(1.0, 0.3);
  float c = fbm(p * 1.4 + drift);
  c += 0.5 * fbm(p * 3.1 + drift * 1.6 + 5.0);
  float cover = smoothstep(0.5, 0.98, c);
  float shade = smoothstep(0.75, 1.3, c);
  vec3 cloud = mix(vec3(1.0), vec3(0.86, 0.9, 0.96), shade);
  vec3 col = mix(sky, cloud, cover * 0.85);
  col = mix(col, vec3(1.0, 0.98, 0.94), 0.12 * (1.0 - uv.y));
  gl_FragColor = vec4(dither(col), 1.0);
}`
}

const VERTEX = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const MAX_W = 1920
const MAX_H = 1200
const LIVE_MIN_W = 150

interface Program {
  program: WebGLProgram
  res: WebGLUniformLocation | null
  time: WebGLUniformLocation | null
}

interface Layer {
  canvas: HTMLCanvasElement
  motion: Motion
  live: boolean
  drawn: boolean
}

const layers = new Set<Layer>()
let gl: WebGLRenderingContext | null = null
let surface: HTMLCanvasElement | null = null
let programs = new Map<Motion, Program>()
let frame = 0

function context(): WebGLRenderingContext | null {
  if (gl && !gl.isContextLost()) return gl

  surface = document.createElement('canvas')
  surface.width = 640
  surface.height = 360
  surface.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    gl = null
    programs = new Map()
    for (const layer of layers) layer.drawn = false
  })

  gl = surface.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: 'low-power'
  })
  if (!gl) return null

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  programs = new Map()
  return gl
}

function compile(g: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = g.createShader(type)
  if (!shader) return null
  g.shaderSource(shader, source)
  g.compileShader(shader)
  if (g.getShaderParameter(shader, g.COMPILE_STATUS)) return shader
  console.error('[Живой фон]', g.getShaderInfoLog(shader))
  g.deleteShader(shader)
  return null
}

function programFor(g: WebGLRenderingContext, motion: Motion): Program | null {
  const known = programs.get(motion)
  if (known) return known

  const vertex = compile(g, g.VERTEX_SHADER, VERTEX)
  const fragment = compile(g, g.FRAGMENT_SHADER, COMMON + SHADERS[motion])
  if (!vertex || !fragment) return null

  const program = g.createProgram()
  if (!program) return null
  g.attachShader(program, vertex)
  g.attachShader(program, fragment)
  g.bindAttribLocation(program, 0, 'a_pos')
  g.linkProgram(program)
  if (!g.getProgramParameter(program, g.LINK_STATUS)) {
    console.error('[Живой фон]', g.getProgramInfoLog(program))
    return null
  }

  const made = {
    program,
    res: g.getUniformLocation(program, 'u_res'),
    time: g.getUniformLocation(program, 'u_time')
  }
  programs.set(motion, made)
  return made
}

function draw(layer: Layer, time: number): boolean {
  const { width, height } = layer.canvas
  if (width < 2 || height < 2) return false

  const g = context()
  if (!g || !surface) return false
  const program = programFor(g, layer.motion)
  if (!program) return false

  if (surface.width < width || surface.height < height) {
    surface.width = Math.max(surface.width, width)
    surface.height = Math.max(surface.height, height)
  }

  g.viewport(0, 0, width, height)
  g.useProgram(program.program)
  g.enableVertexAttribArray(0)
  g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0)
  g.uniform2f(program.res, width, height)
  g.uniform1f(program.time, time)
  g.drawArrays(g.TRIANGLE_STRIP, 0, 4)

  const target = layer.canvas.getContext('2d')
  if (!target) return false
  target.drawImage(surface, 0, surface.height - height, width, height, 0, 0, width, height)
  return true
}

const PERIOD_MS = 1_200_000

const clock = (): number => (Date.now() % PERIOD_MS) / 1000

function tick(): void {
  frame = 0
  const time = clock()
  let more = false
  for (const layer of layers) {
    const live = layer.live && layer.canvas.width >= LIVE_MIN_W
    if (live || !layer.drawn) layer.drawn = draw(layer, time) || layer.drawn
    if (live || !layer.drawn) more = true
  }
  if (more) schedule()
}

function schedule(): void {
  if (!frame) frame = requestAnimationFrame(tick)
}

function fit(layer: Layer): void {
  const box = layer.canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  const width = Math.min(MAX_W, Math.round(box.width * ratio))
  const height = Math.min(MAX_H, Math.round(box.height * ratio))
  if (width === layer.canvas.width && height === layer.canvas.height) return
  layer.canvas.width = width
  layer.canvas.height = height
  layer.drawn = false
  schedule()
}

export function attachMotion(canvas: HTMLCanvasElement, motion: Motion, live: boolean): () => void {
  const layer: Layer = { canvas, motion, live, drawn: false }
  layers.add(layer)
  fit(layer)

  const watch = new ResizeObserver(() => fit(layer))
  watch.observe(canvas)
  schedule()

  return () => {
    watch.disconnect()
    layers.delete(layer)
  }
}
