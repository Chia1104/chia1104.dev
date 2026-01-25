"use client";

import { useRef, useMemo } from "react";

import type { ThreeEvent } from "@react-three/fiber";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const GradientSphere = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const mousePositionRef = useRef(new THREE.Vector3(0, 0, 0));

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

        float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          
          float n = i.x + i.y * 57.0 + i.z * 113.0;
          float a = sin(n) * 43758.5453;
          float b = sin(n + 1.0) * 43758.5453;
          float c = sin(n + 57.0) * 43758.5453;
          float d = sin(n + 58.0) * 43758.5453;
          
          a = fract(a);
          b = fract(b);
          c = fract(c);
          d = fract(d);
          
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        
        float fbm(vec3 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          
          for(int i = 0; i < 4; i++) {
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
          
          float noiseValue = fbm(vWorldPosition * 3.0);
          float noise2 = noise(vWorldPosition * 6.0);
          float noise3 = noise(vWorldPosition * 10.0);
          float combinedNoise = noiseValue * 0.5 + noise2 * 0.3 + noise3 * 0.2;
          
          float angle = atan(vWorldPosition.y, vWorldPosition.x);
          
          float hue = (angle + 3.14159) / (2.0 * 3.14159);
          hue = fract(hue + combinedNoise * 0.4 + time * 0.05);
          
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

  useFrame((state) => {
    if (meshRef.current?.material instanceof THREE.ShaderMaterial) {
      if (meshRef.current.material.uniforms.time) {
        meshRef.current.material.uniforms.time.value = state.clock.elapsedTime;
      }
      if (meshRef.current.material.uniforms.mousePosition) {
        meshRef.current.material.uniforms.mousePosition.value.copy(
          mousePositionRef.current
        );
      }
    }
  });

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!event.point) return;

    mousePositionRef.current.copy(event.point);

    if (
      meshRef.current?.material instanceof THREE.ShaderMaterial &&
      meshRef.current.material.uniforms.hoverIntensity
    ) {
      const currentIntensity =
        meshRef.current.material.uniforms.hoverIntensity.value;
      meshRef.current.material.uniforms.hoverIntensity.value = Math.min(
        currentIntensity + 0.1,
        1.0
      );
    }
  };

  const handlePointerLeave = () => {
    if (
      meshRef.current?.material instanceof THREE.ShaderMaterial &&
      meshRef.current.material.uniforms.hoverIntensity
    ) {
      meshRef.current.material.uniforms.hoverIntensity.value = 0.0;
    }
  };

  return (
    <mesh
      ref={meshRef}
      material={shaderMaterial}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}>
      <sphereGeometry args={[1, 64, 64]} />
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
