"use client";

import { useRef, useMemo } from "react";

import type { ThreeEvent } from "@react-three/fiber";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const GradientSphere = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const mousePositionRef = useRef(new THREE.Vector3(0, 0, 0));
  const hoverIntensityRef = useRef(0.0);
  const targetHoverRef = useRef(0.0);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        lightPosition: { value: new THREE.Vector3(2, 2, 3) },
        mousePosition: { value: new THREE.Vector3(0, 0, 0) },
        hoverIntensity: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        varying vec3 vViewPosition;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;

          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;

          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 lightPosition;
        uniform vec3 mousePosition;
        uniform float hoverIntensity;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        varying vec3 vViewPosition;

        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 105.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        float noise(vec3 p) {
          return snoise(p) * 0.5 + 0.5;
        }

        float fbm(vec3 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          for(int i = 0; i < 3; i++) {
            value += amplitude * noise(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
          }
          return value;
        }

        vec3 hsl2rgb(vec3 hsl) {
          float h = hsl.x;
          float s = hsl.y;
          float l = hsl.z;

          float c = (1.0 - abs(2.0 * l - 1.0)) * s;
          float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
          float m = l - c * 0.5;

          vec3 rgb;
          if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
          else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
          else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
          else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
          else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
          else rgb = vec3(c, 0.0, x);

          return rgb + m;
        }

        void main() {
          vec2 center = vec2(0.5, 0.5);
          float dist = distance(vUv, center);

          float noiseValue = fbm(vWorldPosition * 1.5);
          float noise2 = noise(vWorldPosition * 2.5);
          float noise3 = noise(vWorldPosition * 4.0);
          float combinedNoise = noiseValue * 0.5 + noise2 * 0.3 + noise3 * 0.2;

          float angle = atan(vWorldPosition.y, vWorldPosition.x);

          float hue = (angle + 3.14159) / (2.0 * 3.14159);
          hue = fract(hue + combinedNoise * 0.2 + time * 0.03);

          float saturation = smoothstep(0.0, 0.5, dist * 2.5);
          saturation = pow(saturation, 0.6);
          saturation = clamp(saturation * 1.3, 0.0, 1.0);

          float lightness = mix(0.95, 0.45, pow(dist * 2.0, 1.2));

          vec3 baseColor = hsl2rgb(vec3(hue, saturation, lightness));

          vec3 color = baseColor;

          vec3 lightDir = normalize(lightPosition - vWorldPosition);
          float diffuse = max(dot(vWorldNormal, lightDir), 0.0);

          vec3 viewDir = normalize(vViewPosition);

          float edgeGlow = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 4.0);

          float bottomRightGlow = smoothstep(-0.3, 0.4, vWorldNormal.y) *
                                  smoothstep(-0.2, 0.5, vWorldNormal.x) *
                                  edgeGlow;
          bottomRightGlow *= 0.4;

          float topLeftGlow = smoothstep(0.0, 0.6, vWorldNormal.y) *
                              smoothstep(-0.5, 0.0, vWorldNormal.x) *
                              edgeGlow;
          topLeftGlow *= 0.3;

          float bottomLeftShadow = smoothstep(0.2, -0.5, vWorldNormal.y) *
                                   smoothstep(0.3, -0.4, vWorldNormal.x);
          bottomLeftShadow = bottomLeftShadow * 0.5;

          float shadow = smoothstep(-0.2, 0.5, diffuse);
          shadow = mix(0.8, 1.0, shadow);

          float lightIntensity = 0.95 + diffuse * 0.05;
          lightIntensity *= shadow;

          lightIntensity *= (1.0 - bottomLeftShadow);

          color = color * lightIntensity;

          vec3 bottomRightColor = vec3(1.0) * bottomRightGlow;
          color += bottomRightColor;

          vec3 topLeftColor = vec3(1.0) * topLeftGlow;
          color += topLeftColor;

          float mouseDist = distance(vWorldPosition, mousePosition);
          float hoverRadius = 0.4;
          float hoverEffect = smoothstep(hoverRadius, 0.0, mouseDist) * hoverIntensity;

          vec3 whiteColor = vec3(1.0);
          color = mix(color, whiteColor, hoverEffect * 0.5);

          float glowRadius = 0.6;
          float glowEffect = smoothstep(glowRadius, 0.2, mouseDist) * hoverIntensity;
          color += whiteColor * glowEffect * 0.2;

          color = clamp(color, 0.0, 1.0);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame((state, delta) => {
    if (meshRef.current?.material instanceof THREE.ShaderMaterial) {
      const uniforms = meshRef.current.material.uniforms;
      if (uniforms.time) {
        uniforms.time.value = state.clock.elapsedTime;
      }
      if (uniforms.mousePosition) {
        uniforms.mousePosition.value.lerp(
          mousePositionRef.current,
          1.0 - Math.exp(-8.0 * delta)
        );
      }
      const lerpSpeed = 3.0;
      hoverIntensityRef.current = THREE.MathUtils.lerp(
        hoverIntensityRef.current,
        targetHoverRef.current,
        1.0 - Math.exp(-lerpSpeed * delta)
      );
      if (uniforms.hoverIntensity) {
        uniforms.hoverIntensity.value = hoverIntensityRef.current;
      }
    }
  });

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!event.point) return;
    mousePositionRef.current.copy(event.point);
    targetHoverRef.current = 1.0;
  };

  const handlePointerLeave = () => {
    targetHoverRef.current = 0.0;
  };

  return (
    <mesh
      ref={meshRef}
      material={shaderMaterial}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}>
      <sphereGeometry args={[1, 128, 128]} />
    </mesh>
  );
};

const Opal = () => {
  return (
    <Canvas camera={{ position: [0, 0, 3], fov: 45 }} gl={{ antialias: true }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 2, 3]} intensity={0.8} />
      <pointLight position={[1, -1, 2]} intensity={0.4} color="#ffffff" />
      <GradientSphere />
    </Canvas>
  );
};

export default Opal;
