/**
 * Liquid Wobble / Slosh Shader — v2
 *
 * Physics-motivated surface simulation for a spinning, axially-tilted bottle.
 *
 * Key uniforms:
 *   uGravTiltX / uGravTiltZ  — components of world gravity projected into
 *                              the bottle's local frame, recomputed every frame
 *                              from the bottle's actual rotation matrix.
 *                              Drives the "liquid surface stays horizontal"
 *                              effect correctly as the bottle spins.
 *   uSlosh                   — slosh energy [0..1] that spikes on angular
 *                              acceleration and decays naturally. Controls
 *                              wave amplitude.
 *   uSpin                    — current rotation speed. Drives the centrifugal
 *                              paraboloid + ring-ripple effects.
 *
 * Surface-factor trick: max(0, normal.y) gates ALL displacement so only the
 * liquid–air interface (top surface) deforms. Sides and bottom are always still,
 * exactly like liquid in a container.
 */

export const liquidVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uGravTiltX;
  uniform float uGravTiltZ;
  uniform float uSlosh;
  uniform float uSpin;

  varying vec3  vNormal;
  varying vec3  vWorldPos;
  varying vec3  vViewPos;
  varying float vSurface;

  void main() {
    vec3 pos = position;

    // Smooth surface factor — upward normals = liquid-air interface
    float sf = smoothstep(-0.05, 0.35, normal.y);
    vSurface = sf;

    // 1. Gravity tilt — keeps the liquid surface level as the bottle spins
    float gravTilt = -(pos.x * uGravTiltX + pos.z * uGravTiltZ);
    pos.y += gravTilt * sf;

    // 2. Slosh waves — incommensurate frequencies prevent regular grid artefacts
    float A = uSlosh * 0.048;
    pos.y += sin(pos.x *  4.3 + uTime * 2.6)          * A        * sf;
    pos.y += sin(pos.z *  5.7 + uTime * 2.1)          * A * 0.82 * sf;
    pos.y += sin((pos.x + pos.z) * 3.5 + uTime * 1.9) * A * 0.68 * sf;
    pos.y += sin((pos.x - pos.z) * 4.8 - uTime * 2.4) * A * 0.55 * sf;
    pos.y += sin(pos.x * 13.7 + uTime * 4.2) * uSlosh * 0.007 * sf;
    pos.y += sin(pos.z * 11.1 + uTime * 3.6) * uSlosh * 0.007 * sf;

    // 3. Centrifugal paraboloid + ring ripples from spin
    float r  = length(pos.xz);
    float r2 = r * r;
    float parabola = uSpin * uSpin * r2 * 0.09;
    float rings    = sin(r * 10.5 - uTime * 5.8) * uSpin * 0.018;
    pos.y += (parabola + rings) * sf;

    // 4. Idle capillary ripples
    pos.y += (sin(pos.x * 19.0 + uTime * 1.6) * 0.003
            + sin(pos.z * 15.5 + uTime * 2.0) * 0.003) * sf;

    vNormal   = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vViewPos   = mvPos.xyz;

    gl_Position = projectionMatrix * mvPos;
  }
`;

export const liquidFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uOpacity;

  varying vec3  vNormal;
  varying vec3  vWorldPos;
  varying vec3  vViewPos;
  varying float vSurface;

  // GGX microfacet NDF — tight, realistic highlight
  float D_GGX(float NdotH, float roughness) {
    float a  = roughness * roughness;
    float a2 = a * a;
    float d  = NdotH * NdotH * (a2 - 1.0) + 1.0;
    return a2 / (3.14159265 * d * d + 1e-6);
  }

  void main() {
    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;

    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(vec3(3.0, 5.0, 3.0));
    vec3 H = normalize(L + V);

    float NdotL = max(dot(N, L), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    float NdotV = max(dot(N, V), 0.001);

    // Beer-Lambert depth coloration.
    // vSurface=1 at the liquid-air interface, 0 at sides/bottom.
    // Sides = viewer looks through more liquid = richer, darker colour.
    // Whiskey absorbs blue strongly, green moderately, red least.
    float depth    = 1.0 - vSurface * 0.65;
    vec3  absorb   = exp(-vec3(0.10, 0.50, 3.80) * depth * 2.8);
    vec3  volColor = uColor * clamp(absorb * 0.85 + 0.12, 0.0, 1.0);

    // Lambertian diffuse — restrained, liquid interior is self-illuminated
    float diff = 0.18 + 0.52 * NdotL;

    // GGX specular on the liquid surface (roughness 0.03 = very polished)
    float spec = D_GGX(NdotH, 0.03) * NdotL * 0.22;

    // Schlick Fresnel — F0 = 0.04 for water / spirits
    float fresnel = 0.04 + 0.96 * pow(1.0 - NdotV, 5.0);

    // Warm backlit glow — lamp light punching through from behind the bottle
    float backlit = pow(max(dot(-V, L), 0.0), 1.8) * 0.18;

    // Meniscus shimmer — tight ring of brightness at the liquid-air boundary
    float meniscus = smoothstep(0.62, 0.80, vSurface)
                   * smoothstep(1.00, 0.82, vSurface)
                   * (0.5 + 0.5 * sin(uTime * 1.2)) * 0.12;

    vec3 col  = volColor * diff;
    col      += vec3(0.98, 0.93, 0.80) * spec;    // warm sharp highlight
    col      += volColor * fresnel * 0.22;         // subtle Fresnel edge
    col      += volColor * backlit;                // warm transmitted glow
    col      += vec3(1.0, 0.88, 0.60) * meniscus; // meniscus ring shimmer

    float alpha = uOpacity + fresnel * 0.04;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;
