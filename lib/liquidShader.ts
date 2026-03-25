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
  uniform float uGravTiltX;  // tan(bottle_tilt) * cos(rotY) — X gravity component
  uniform float uGravTiltZ;  // tan(bottle_tilt) * sin(rotY) — Z gravity component
  uniform float uSlosh;      // slosh energy [0..1]
  uniform float uSpin;       // rotation speed [0..1]

  varying vec3  vNormal;
  varying vec3  vWorldPos;
  varying float vSurface;    // passed to fragment for caustic gating

  void main() {
    vec3 pos = position;

    // ── Surface factor ────────────────────────────────────────────────────
    // Upward-facing normals  = liquid-air interface → full displacement.
    // Side / bottom normals  = container walls      → zero displacement.
    float sf = max(0.0, normal.y);
    vSurface = sf;

    // ── 1. Gravity tilt ──────────────────────────────────────────────────
    // The liquid surface must remain perpendicular to world-space gravity.
    // When the bottle tilts/spins the surface counter-tilts in model space.
    // uGravTiltX/Z are the horizontal gravity components in the bottle frame.
    float gravTilt = -(pos.x * uGravTiltX + pos.z * uGravTiltZ);
    pos.y += gravTilt * sf;

    // ── 2. Slosh waves (4 travelling waves for an organic, chaotic look) ──
    // Amplitude scales with slosh energy — bursts on jerk, decays smoothly.
    float A = uSlosh * 0.062;
    float w = 0.0;
    w += sin(pos.x *  5.8 + uTime * 3.10) * A;
    w += sin(pos.z *  6.4 + uTime * 2.75) * A * 0.90;
    w += sin((pos.x + pos.z) * 4.2 + uTime * 2.40) * A * 0.75;
    w += sin((pos.x - pos.z) * 5.1 - uTime * 2.90) * A * 0.65;
    pos.y += w * sf;

    // ── 3. Centrifugal paraboloid + ring ripples (from spin) ─────────────
    // Fast spin depresses the centre and raises the edges (paraboloid).
    // Secondary ring ripples radiate outward.
    float r2       = dot(pos.xz, pos.xz);
    float r        = sqrt(r2);
    float parabola = uSpin * uSpin * r2 * 0.12;
    float rings    = sin(r * 13.0 - uTime * 6.5) * uSpin * 0.024;
    pos.y += (parabola + rings) * sf;

    // ── 4. Idle capillary ripples (always on, very subtle) ───────────────
    float capillary = sin(pos.x * 21.0 + uTime * 1.7) * 0.0028
                    + sin(pos.z * 17.0 + uTime * 2.1) * 0.0028;
    pos.y += capillary * sf;

    vNormal   = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const liquidFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;    // base liquid colour
  uniform float uOpacity;  // base transparency

  varying vec3  vNormal;
  varying vec3  vWorldPos;
  varying float vSurface;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);

    // ── Diffuse + key light ──────────────────────────────────────────────
    vec3  L    = normalize(vec3(2.0, 4.0, 2.5));
    float diff = 0.20 + 0.80 * max(dot(N, L), 0.0);

    // ── Blinn-Phong specular ─────────────────────────────────────────────
    vec3  H    = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 110.0) * 0.85;

    // ── Fresnel edge glow ────────────────────────────────────────────────
    float NdotV   = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 3.2);

    // ── Subsurface scattering approximation ──────────────────────────────
    // Simulates light entering through the opposite face of the liquid volume.
    float sss = pow(max(dot(-V, N), 0.0), 2.5) * 0.45;

    // ── Caustic shimmer (liquid surface only, gated by vSurface) ─────────
    // Two interfering sine waves create a natural shimmer pattern.
    vec2  cUV     = vWorldPos.xz * 18.0 + uTime * vec2(1.4, 1.1);
    float c1      = sin(cUV.x) * sin(cUV.y);
    float c2      = sin(cUV.x * 1.3 + 0.7) * sin(cUV.y * 0.85 + uTime * 0.65);
    float caustic = max(0.0, c1 * c2) * vSurface * 0.20;

    // ── Compose colour ───────────────────────────────────────────────────
    vec3 col = uColor * diff;
    col += vec3(spec);                                          // specular highlight
    col += uColor * fresnel * 0.50;                            // warm Fresnel glow
    col += uColor * sss * 0.35;                                // subsurface warmth
    col += vec3(caustic * 1.6, caustic * 0.95, caustic * 0.1); // caustic shimmer

    // \u2500\u2500 Alpha \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    // Opaque at edges (Fresnel) and surface, translucent in the interior.
    float alpha = uOpacity
                + fresnel   * 0.20
                + vSurface  * 0.07;

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;
