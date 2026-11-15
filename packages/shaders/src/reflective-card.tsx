"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@chia/ui/utils/cn.util";

/*
 * Adapted from React Bits' ReflectiveCard (https://reactbits.dev). The original paints a metal
 * plate that mirrors a video; here the card's face is whatever `children` render, and the shader
 * draws only the light on it, so the face stays an ordinary image.
 */

/** Distance of the eye from the card, in CSS pixels; also the CSS perspective. */
const VIEW_DISTANCE = 900;
/** The light sweeps across once on mount, on springs slowed for this long. */
const INTRO_MS = 1400;
const TILT_DEGREES = 10;

const VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

/**
 * Lights a rounded plate that tilts with `uRotate`: a studio softbox whose reflection sweeps as
 * the plate turns, a glare under the pointer, a polished bevel, brushed grain and gentle bends.
 * The output is premultiplied: `rgb` is light added over the face, `a` is how much the room's
 * dark side dims it.
 */
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2 uSize;
uniform float uRadius;
uniform float uScale;
uniform mat3 uRotate;
uniform float uGlare;
uniform vec2 uPointer;

const float VIEW = ${VIEW_DISTANCE.toFixed(1)};
const float ROUGH = 0.3;
const float WARP = 0.6;
const float BEVEL = 3.0;
const float SOFTNESS = 6.0;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0;
}

vec3 gradientNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = hash2(i);
  vec2 gb = hash2(i + vec2(1.0, 0.0));
  vec2 gc = hash2(i + vec2(0.0, 1.0));
  vec2 gd = hash2(i + vec2(1.0, 1.0));
  float va = dot(ga, f);
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));
  float k = va - vb - vc + vd;
  float value = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
  vec2 slope = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) + du * (u.yx * k + vec2(vb, vc) - va);
  return vec3(value, slope);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float erf(float x) {
  float x2 = x * x;
  return sign(x) * sqrt(1.0 - exp(-x2 * (1.2732395 + 0.147 * x2) / (1.0 + 0.147 * x2)));
}

float band(float x, float halfWidth, float sigma) {
  float s = 1.4142136 * max(sigma, 0.0001);
  return 0.5 * (erf((x + halfWidth) / s) - erf((x - halfWidth) / s));
}

float strip(vec2 q, vec2 center, vec2 dir, float halfWidth, vec2 sigma) {
  vec2 normal = vec2(-dir.y, dir.x);
  return band(dot(q - center, normal), halfWidth, length(sigma * normal));
}

const vec2 SWEEP = vec2(0.5, 0.86);

float softbox(vec2 q, vec2 sigma) {
  float key = strip(q, vec2(-0.1, -0.16), normalize(SWEEP), 0.022, sigma + 0.018);
  float top = band(q.y + 0.6, 0.12, sigma.y + 0.05);
  float side = band(q.x - 0.46, 0.05, sigma.x + 0.05);
  return key + top * 0.8 + side * 0.35;
}

float room(vec2 q, vec2 sigma) {
  float fall = smoothstep(-0.55, 0.5, q.y);
  float flag = strip(q, vec2(0.24, -0.02), normalize(SWEEP), 0.09, sigma + 0.08);
  return mix(0.85, 0.12, fall) * (1.0 - 0.6 * flag);
}

void main() {
  vec2 p = vec2(vUv.x - 0.5, 0.5 - vUv.y) * uSize;
  vec2 halfSize = uSize * 0.5;
  float r = min(uRadius, min(halfSize.x, halfSize.y));
  vec2 corner = abs(p) - halfSize + r;
  vec2 side = vec2(p.x >= 0.0 ? 1.0 : -1.0, p.y >= 0.0 ? 1.0 : -1.0);
  float d;
  vec2 outward;
  if (corner.x > 0.0 && corner.y > 0.0) {
    d = length(corner) - r;
    outward = normalize(corner) * side;
  } else if (corner.x > corner.y) {
    d = corner.x - r;
    outward = vec2(side.x, 0.0);
  } else {
    d = corner.y - r;
    outward = vec2(0.0, side.y);
  }
  float coverage = clamp(0.5 - d * uScale, 0.0, 1.0);

  float chamferWidth = min(BEVEL, max(r, 1.0));
  float chamfer = 1.0 - smoothstep(0.0, chamferWidth, -d);
  vec2 slope = outward * chamfer;

  vec2 wp = p / 220.0;
  vec3 w1 = gradientNoise(wp);
  vec3 w2 = gradientNoise(wp * 2.07 + 13.7);
  slope += (w1.yz + w2.yz * 0.5) * WARP * 0.008;

  float grain = valueNoise(vec2(p.x * 0.008, p.y * 0.55)) * 0.45 + valueNoise(vec2(p.x * 0.019 + 3.7, p.y * 0.23)) * 0.35 + valueNoise(vec2(p.x * 0.004 + 9.2, p.y * 0.09)) * 0.2;
  float brush = ROUGH * ROUGH;
  slope.y += (grain - 0.5) * brush * 0.004;

  vec3 normal = uRotate * normalize(vec3(slope, 1.0));
  vec3 position = uRotate * vec3(p, 0.0);
  vec3 view = normalize(position - vec3(0.0, 0.0, VIEW));
  vec3 bounce = reflect(view, normal);
  vec2 q = bounce.xy / max(bounce.z, 0.2);

  vec2 footprint = fwidth(q);
  vec2 sigma = sqrt(vec2(SOFTNESS / VIEW) * vec2(SOFTNESS / VIEW) + footprint * footprint * 0.5);
  sigma += vec2(0.004, 0.05) * ROUGH;

  vec2 toPointer = (uPointer - p) / (120.0 + SOFTNESS * 4.0);
  vec2 spread = toPointer * vec2(1.0, 1.0 / (1.0 + 2.5 * ROUGH));
  float reach = dot(spread, spread);
  float glint = max(1.0 + 3.0 * dot(slope, toPointer), 0.0);
  float glare = (exp(-reach * 1.6) + exp(-reach * 0.35) * 0.15) * glint * uGlare;
  float highlight = (softbox(q, sigma) + glare) * (1.0 + 0.8 * (grain - 0.5) * brush);

  // The bevel is polished, so it catches more of every light than the face does.
  vec3 light = vec3(highlight * 0.34 + chamfer * (0.07 + highlight * 0.4));
  light = 1.0 - exp(-light);
  light += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  float shade = clamp(0.3 * (1.0 - room(q, sigma)) + chamfer * 0.12, 0.0, 0.6);

  fragColor = vec4(max(light, 0.0) * coverage, shade * coverage);
}`;

const UNIFORMS = [
  "uSize",
  "uRadius",
  "uScale",
  "uRotate",
  "uGlare",
  "uPointer",
] as const;

type UniformName = (typeof UNIFORMS)[number];

interface PlateFrame {
  width: number;
  height: number;
  radius: number;
  /** Radians. */
  rotateX: number;
  rotateY: number;
  glare: number;
  pointerX: number;
  pointerY: number;
}

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
};

/** `null` where WebGL2 is missing or the program does not build; the face then shows unlit. */
const createRenderer = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "default",
  });
  if (!gl) return null;

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = vertex && fragment ? gl.createProgram() : null;
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const uniform = new Map<UniformName, WebGLUniformLocation | null>(
    UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)])
  );
  const locate = (name: UniformName) => uniform.get(name) ?? null;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One triangle that covers the clip space.
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(program);

  const rotation = new Float32Array(9);

  return {
    render(frame: PlateFrame) {
      const cx = Math.cos(frame.rotateX);
      const sx = Math.sin(frame.rotateX);
      const cy = Math.cos(frame.rotateY);
      const sy = Math.sin(frame.rotateY);
      rotation.set([cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy]);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(locate("uSize"), frame.width, frame.height);
      gl.uniform1f(locate("uRadius"), frame.radius);
      gl.uniform1f(locate("uScale"), canvas.width / Math.max(1, frame.width));
      gl.uniformMatrix3fv(locate("uRotate"), false, rotation);
      gl.uniform1f(locate("uGlare"), frame.glare);
      gl.uniform2f(locate("uPointer"), frame.pointerX, frame.pointerY);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      if (gl.isContextLost()) return;
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** One axis of tilt, from -1 to 1, on a spring. */
interface Spring {
  position: number;
  velocity: number;
  target: number;
}

interface ReflectiveCardProps {
  /** The card's face: an image that fills it. */
  children: ReactNode;
  /** Corner radius in CSS pixels; the bevel follows it. */
  radius?: number;
  /** Renders as it does under the system's reduced-motion setting: no tilt, no opening sweep. */
  reducedMotion?: boolean;
  className?: string;
}

/**
 * A card that tilts towards the pointer under studio light: a band of light sweeps its face as
 * it turns, a glare follows the pointer and its bevel catches both. It draws only while
 * something moves, and holds still under reduced motion.
 */
export const ReflectiveCard = ({
  children,
  radius = 12,
  reducedMotion = false,
  className,
}: ReflectiveCardProps) => {
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  /** Bumped when a lost GL context comes back, which rebuilds the renderer. */
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const rootElement = root.current;
    const bodyElement = body.current;
    const canvasElement = canvas.current;
    if (!rootElement || !bodyElement || !canvasElement) return;

    const renderer = createRenderer(canvasElement);
    if (!renderer) return;

    const reduced =
      reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tilt = reduced ? 0 : TILT_DEGREES;
    const x: Spring = { position: 0, velocity: 0, target: 0 };
    const y: Spring = { position: 0, velocity: 0, target: 0 };
    const light = { level: 0, target: 0 };
    const pointer = { x: 0, y: 0 };
    const size = { width: 0, height: 0 };
    let slowUntil = 0;
    let touchId: number | null = null;
    let frameId = 0;
    let last = 0;
    let onScreen = true;
    let pageVisible = document.visibilityState !== "hidden";
    let lost = false;
    let resizePending = true;

    const applyResize = () => {
      size.width = bodyElement.offsetWidth;
      size.height = bodyElement.offsetHeight;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvasElement.width = Math.max(1, Math.round(size.width * scale));
      canvasElement.height = Math.max(1, Math.round(size.height * scale));
    };

    const draw = (now: number) => {
      frameId = 0;
      if (lost) return;
      if (resizePending) {
        resizePending = false;
        applyResize();
      }
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      const slow = now < slowUntil;
      const stiffness = slow ? 24 : 120;
      const damping = slow ? 9 : 16;
      const steps = Math.max(1, Math.ceil(dt * 120));
      const step = dt / steps;
      for (let index = 0; index < steps; index++) {
        for (const axis of [x, y]) {
          axis.velocity +=
            (stiffness * (axis.target - axis.position) -
              damping * axis.velocity) *
            step;
          axis.position += axis.velocity * step;
        }
      }
      // Light comes up quickly and lingers on the way out.
      const tau = light.target > light.level ? 0.18 : slow ? 0.9 : 0.45;
      light.level += (light.target - light.level) * (1 - Math.exp(-dt / tau));

      const moving =
        Math.abs(x.target - x.position) > 0.0005 ||
        Math.abs(y.target - y.position) > 0.0005 ||
        Math.abs(x.velocity) > 0.0005 ||
        Math.abs(y.velocity) > 0.0005 ||
        Math.abs(light.target - light.level) > 0.002;
      if (!moving) {
        x.position = x.target;
        y.position = y.target;
        x.velocity = 0;
        y.velocity = 0;
        light.level = light.target;
      }

      const rotateX = y.position * tilt;
      const rotateY = -x.position * tilt;
      bodyElement.style.transform = `rotateX(${rotateX.toFixed(3)}deg) rotateY(${rotateY.toFixed(3)}deg)`;
      renderer.render({
        width: size.width,
        height: size.height,
        radius,
        rotateX: (rotateX * Math.PI) / 180,
        rotateY: (rotateY * Math.PI) / 180,
        glare: 0.5 * light.level,
        pointerX: pointer.x,
        pointerY: pointer.y,
      });

      if (moving && onScreen && pageVisible) {
        frameId = requestAnimationFrame(draw);
      }
    };

    const wake = () => {
      if (frameId || lost || !onScreen || !pageVisible) return;
      last = performance.now();
      frameId = requestAnimationFrame(draw);
    };

    const aim = (nx: number, ny: number, lit: boolean) => {
      x.target = clamp(nx, -1, 1);
      y.target = clamp(ny, -1, 1);
      light.target = lit ? 1 : 0;
      slowUntil = 0;
      wake();
    };

    const aimAt = (event: PointerEvent) => {
      const rect = rootElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      pointer.x = nx * size.width * 0.5;
      pointer.y = ny * size.height * 0.5;
      aim(nx, ny, true);
    };

    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") aimAt(event);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || event.pointerId === touchId) {
        aimAt(event);
      }
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") aim(0, 0, false);
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      touchId = event.pointerId;
      aimAt(event);
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== touchId) return;
      touchId = null;
      aim(0, 0, false);
    };
    rootElement.addEventListener("pointerenter", onEnter);
    rootElement.addEventListener("pointermove", onMove);
    rootElement.addEventListener("pointerleave", onLeave);
    rootElement.addEventListener("pointerdown", onDown);
    rootElement.addEventListener("pointerup", onUp);
    rootElement.addEventListener("pointercancel", onUp);

    const onLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(frameId);
      frameId = 0;
    };
    const onRestored = () => setGeneration((value) => value + 1);
    canvasElement.addEventListener("webglcontextlost", onLost);
    canvasElement.addEventListener("webglcontextrestored", onRestored);

    const resizeObserver = new ResizeObserver(() => {
      resizePending = true;
      wake();
    });
    resizeObserver.observe(bodyElement);

    const intersection = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      wake();
    });
    intersection.observe(rootElement);

    const onVisibility = () => {
      pageVisible = document.visibilityState !== "hidden";
      wake();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // The first paint starts turned away with the light on, so settling sweeps the band across.
    if (!reduced && generation === 0) {
      applyResize();
      x.position = 0.62;
      y.position = -0.55;
      light.level = 1;
      pointer.x = 0.62 * size.width * 0.5;
      pointer.y = -0.55 * size.height * 0.5;
      slowUntil = performance.now() + INTRO_MS;
    }
    wake();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      rootElement.removeEventListener("pointerenter", onEnter);
      rootElement.removeEventListener("pointermove", onMove);
      rootElement.removeEventListener("pointerleave", onLeave);
      rootElement.removeEventListener("pointerdown", onDown);
      rootElement.removeEventListener("pointerup", onUp);
      rootElement.removeEventListener("pointercancel", onUp);
      canvasElement.removeEventListener("webglcontextlost", onLost);
      canvasElement.removeEventListener("webglcontextrestored", onRestored);
      bodyElement.style.transform = "";
      renderer.dispose();
    };
  }, [generation, radius, reducedMotion]);

  return (
    <div
      ref={root}
      className={cn("relative touch-pan-y select-none", className)}
      style={{ perspective: VIEW_DISTANCE }}>
      <div
        ref={body}
        className="relative isolate size-full overflow-hidden will-change-transform"
        style={{ borderRadius: radius }}>
        {children}
        <canvas
          ref={canvas}
          aria-hidden
          className="pointer-events-none absolute inset-0 block size-full"
        />
      </div>
    </div>
  );
};
