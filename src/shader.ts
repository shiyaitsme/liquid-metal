export const vertexSource = /* glsl */ `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const MAX_RIPPLES = 24;

export const fragmentSource = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uPress;
uniform vec3  uRipples[${MAX_RIPPLES}];
uniform vec3  uTint;
uniform vec3  uTint2;
uniform float uIrid;
uniform float uDark;
uniform float uGloss;

out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = r * p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}

float height(vec2 p) {
  float t = uTime * 0.07;
  vec2 q = p * 0.75;
  vec2 w = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, 1.3) - t));
  float h = fbm(q + 2.2 * w + vec2(t, -t * 0.6));

  vec2 dm = p - uMouse;
  h -= (0.10 + 0.10 * uPress) * exp(-dot(dm, dm) * 3.2);

  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec3 r = uRipples[i];
    float age = uTime - r.z;
    if (age > 0.0 && age < 5.0) {
      float d = length(p - r.xy);
      float front = age * 0.55;
      float x = d - front;
      float env = exp(-x * x * 18.0) * exp(-age * 0.9);
      h += 0.075 * env * cos(x * 26.0);
    }
  }
  return h;
}

vec3 environment(vec3 r) {
  float y = r.y * 0.5 + 0.5;
  vec3 sky = mix(vec3(0.015, 0.02, 0.04), vec3(0.75, 0.82, 0.95), smoothstep(0.25, 1.0, y));
  float horizon = exp(-pow((r.y - 0.02) * 5.0, 2.0));
  vec3 col = sky * (1.0 - 0.6 * uDark) + horizon * vec3(1.0, 0.92, 0.85) * 0.9;

  float bandA = smoothstep(0.55, 0.95, sin(r.y * 9.0 + r.x * 2.5 + 0.6));
  col += bandA * 0.28 * (1.0 - 0.7 * uDark) * vec3(0.9, 0.95, 1.0);

  float boxA = smoothstep(0.35, 0.3, abs(r.x - 0.55)) * smoothstep(0.55, 0.5, abs(r.y - 0.45));
  float boxB = smoothstep(0.2, 0.16, abs(r.x + 0.6)) * smoothstep(0.7, 0.65, abs(r.y + 0.1));
  col += boxA * vec3(1.6, 1.55, 1.45);
  col += boxB * vec3(0.9, 1.0, 1.2) * 0.6;

  float floorMask = smoothstep(0.0, -0.6, r.y);
  col = mix(col, vec3(0.01, 0.012, 0.02) + horizon * 0.2, floorMask * 0.6);
  return col;
}

vec3 cosPalette(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
}

void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;

  float e = 0.004;
  float h0 = height(p);
  float hx = height(p + vec2(e, 0.0));
  float hy = height(p + vec2(0.0, e));
  vec2 grad = vec2(hx - h0, hy - h0) / e;
  vec3 n = normalize(vec3(-grad * 0.26, 1.0));

  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 r = reflect(-v, n);

  float ndv = clamp(dot(n, v), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);

  vec3 env = environment(r);
  float lum = dot(env, vec3(0.3, 0.59, 0.11));
  vec3 metal = env * mix(uTint, uTint2, smoothstep(0.1, 1.2, lum));

  vec3 irid = cosPalette(ndv * 1.6 + h0 * 1.3 + uTime * 0.02);
  metal = mix(metal, metal * (0.35 + 1.4 * irid), uIrid);
  metal += fres * 0.22 * mix(vec3(1.0), irid, uIrid);

  vec3 L = vec3(uMouse - p, 0.55);
  float dist = length(L);
  L /= dist;
  vec3 H = normalize(L + v);
  float att = 1.0 / (1.0 + dist * dist * 1.4);
  float spec = pow(max(dot(n, H), 0.0), 140.0 * uGloss) * 2.4;
  float sheen = pow(max(dot(n, H), 0.0), 18.0) * 0.18;
  float diff = max(dot(n, L), 0.0);
  vec3 lightCol = mix(vec3(1.0, 0.96, 0.9), irid, uIrid * 0.5);
  metal += (spec + sheen) * att * lightCol * 1.6;
  metal += diff * att * 0.09 * uTint;

  float cav = smoothstep(0.35, 0.75, h0);
  metal *= 0.82 + 0.3 * cav;

  float vig = smoothstep(2.1, 0.35, length(p * vec2(0.85, 1.0)));
  metal *= 0.45 + 0.55 * vig;

  metal = metal / (1.0 + metal * 0.55);
  metal = pow(metal, vec3(0.92));
  metal = mix(metal, smoothstep(0.0, 1.0, metal), 0.35);

  float grain = hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5;
  metal += grain * 0.022;

  outColor = vec4(clamp(metal, 0.0, 1.0), 1.0);
}
`;
