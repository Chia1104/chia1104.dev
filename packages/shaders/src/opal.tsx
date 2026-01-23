"use client";

import { useRef } from "react";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import type * as THREE from "three";

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    vNormal  = normalize(normalMatrix * normal);
    vViewDir = -mvPosition.xyz;
    vUv      = uv;
    vPosition = position;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec2 vUv;
  varying vec3 vPosition;

  // Smooth HSV to RGB conversion
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);

    // Fresnel effect for edge highlighting
    float ndotv = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - ndotv, 2.5);

    // Convert position to spherical coordinates for smooth radial gradient
    vec3 pos = normalize(vPosition);
    float theta = atan(pos.z, pos.x); // Horizontal angle
    float phi = asin(pos.y); // Vertical angle
    
    // Create smooth color gradient using spherical coordinates
    float time = uTime * 0.25; // Faster animation
    
    // Radial gradient from center to edge
    float radialGradient = length(vUv - 0.5) * 2.0;
    
    // Combine angles for smooth color distribution with purple as the base
    float hueVariation = (theta / 6.28318) + (phi / 3.14159) * 0.4 + time * 0.3;
    
    // Multi-frequency waves to create more uniform distribution
    float wave1 = sin(hueVariation * 3.14159) * 0.5 + 0.5;
    float wave2 = sin(hueVariation * 6.28318 + time) * 0.5 + 0.5;
    float wave3 = cos(hueVariation * 4.71239 - time * 0.5) * 0.5 + 0.5;
    
    // Blend waves and apply smoothstep to compress extremes
    float blended = wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2;
    // Apply smoothstep twice to create more linear middle range
    float normalizedVariation = smoothstep(0.1, 0.9, blended);
    normalizedVariation = smoothstep(0.0, 1.0, normalizedVariation);
    
    // Narrower range: 0.6 (blue) through 0.7 (purple) to 0.85 (magenta/pink)
    // Keeps colors closer together, more harmonious transitions
    float hue = mix(0.6, 0.85, normalizedVariation);
    
    // Create base color with smooth HSV gradient
    vec3 baseColor = hsv2rgb(vec3(hue, 0.8, 0.95));
    
    // Add radial variation with offset color, staying close to base hue
    float radialMix = smoothstep(0.3, 1.0, radialGradient);
    // Smaller offset for center color to keep colors cohesive
    float centerHue = hue + sin(time * 2.0) * 0.08; // Oscillate ±0.08 around base hue
    centerHue = clamp(centerHue, 0.6, 0.85); // Ensure it stays in range
    vec3 centerColor = hsv2rgb(vec3(centerHue, 0.65, 1.0));
    baseColor = mix(centerColor, baseColor, radialMix);
    
    // Soft edge highlight with fresnel
    vec3 edgeGlow = vec3(1.0) * fresnel * 0.5;
    
    // Larger specular highlight (right-top)
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    vec3 reflectDir = reflect(-lightDir, N);
    float spec = pow(max(dot(V, reflectDir), 0.0), 20.0); // Lower power = larger highlight
    vec3 specular = vec3(1.0) * spec * 0.7; // Increased intensity
    
    // Add shadow effect (left-bottom)
    // Calculate how much the surface faces towards the light
    float lightDot = dot(N, lightDir);
    // Create shadow on the opposite side of the light
    float shadow = smoothstep(-0.5, 0.3, lightDot); // Smooth transition from dark to light
    // Darken the base color in shadow areas
    vec3 shadowColor = baseColor * (0.4 + shadow * 0.6); // Shadows are 40% brightness, lit areas are full
    
    // Combine all elements
    vec3 finalColor = shadowColor + edgeGlow + specular;
    
    // Ensure colors stay in valid range
    finalColor = clamp(finalColor, 0.0, 1.0);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

function OpalSphere() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (!materialRef.current?.uniforms.uTime) return;
    materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        uniforms={{
          uTime: { value: 0 },
        }}
      />
    </mesh>
  );
}

export default function Opal() {
  return (
    <Canvas
      camera={{ position: [0, 0, 3], fov: 45 }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1.0} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />
      <OpalSphere />
      <OrbitControls enableDamping enableZoom={false} />
    </Canvas>
  );
}
