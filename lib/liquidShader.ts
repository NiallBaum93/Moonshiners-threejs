/**
 * Liquid Wobble / Slosh Shader
 *
 * The core trick: we weight all vertex displacement by `max(0, normal.y)` — the
 * "surface factor". Only upward-facing normals (i.e. the liquid's top surface)
 * receive wobble. The bottom and sides remain still, just like real liquid in a
 * container.
 *
 * Two main effects:
 *  1. YAW (spinning on Y axis)  → centrifugal ripple rings + cross-slosh waves
 *  2. PITCH (tilting on X axis) → surface tilt + sloshing waves
 */

export const liquidVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uYawVelocity;    // horizontal rotation speed  (L/R drag)
  uniform float uPitchVelocity;  // vertical tilt speed        (U/D drag)
  uniform float uRotX;           // actual bottle pitch angle — drives static tilt

  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 pos = position;

    // ── Surface factor ─────────────────────────────────────────────────────
    // Upward-facing normals = liquid top surface → full effect
    // Side/bottom normals   → no displacement (liquid stays in the container)
    float sf = max(0.0, normal.y);

    // ── Effect 1: Centrifugal ripple rings (from Y-axis spin) ──────────────
    float r = length(pos.xz);
    float ripple = sin(r * 12.0 - uTime * 6.5) * 0.038 * uYawVelocity;
    pos.y += ripple * sf;

    // ── Effect 2: Cross-slosh standing wave (spin-induced) ─────────────────
    float crossSlosh = sin(pos.x * 9.0 + uTime * 4.2) * 0.030 * uYawVelocity
                     + cos(pos.z * 7.5 + uTime * 3.8) * 0.025 * uYawVelocity;
    pos.y += crossSlosh * sf;

    // ── Effect 3: Liquid surface stays level as bottle tilts ─────────────────
    // uRotX is the actual pitch angle of the bottle group. The liquid tilts in
    // the opposite direction so its surface appears to stay horizontal.
    float tilt = pos.z * uRotX * 1.6;
    pos.y += tilt * sf;

    // ── Effect 4: Pitch-induced slosh waves ────────────────────────────────
    float pitchSlosh = sin(pos.z * 8.0 + uTime * 3.5) * 0.032 * abs(uPitchVelocity)
                     + sin(pos.x * 6.5 + uTime * 4.8) * 0.022 * abs(uPitchVelocity);
    pos.y += pitchSlosh * sf;

    // ── Idle micro-ripple (always on, very subtle) ──────────────────────────
    float idle = sin(pos.x * 14.0 + uTime * 1.8) * 0.004
               + sin(pos.z * 12.0 + uTime * 2.2) * 0.004;
    pos.y += idle * sf;

    // ── Varyings ────────────────────────────────────────────────────────────
    vNormal    = normalize(normalMatrix * normal);
    vWorldPos  = (modelMatrix * vec4(pos, 1.0)).xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const liquidFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;      // base liquid colour (amber for whiskey/moonshine)
  uniform float uOpacity;    // base transparency

  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);

    // ── Diffuse lighting ────────────────────────────────────────────────────
    vec3 L    = normalize(vec3(2.0, 3.5, 2.0));
    float diff = 0.25 + 0.75 * max(dot(N, L), 0.0);

    // ── Blinn-Phong specular ────────────────────────────────────────────────
    vec3  H    = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 90.0) * 0.65;

    // ── Fresnel edge glow ───────────────────────────────────────────────────
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8);

    // ── Caustic shimmer on the liquid surface ───────────────────────────────
    // Only fires on upward-facing normals (N.y > 0)
    float causticRaw = max(0.0,
        sin(vWorldPos.x * 30.0 + uTime * 3.8) *
        sin(vWorldPos.z * 26.0 + uTime * 2.6)
    );
    float caustic = causticRaw * max(0.0, N.y) * 0.14;

    // ── Compose colour ──────────────────────────────────────────────────────
    vec3 col = uColor * diff;
    col += vec3(spec);                                 // white highlight
    col += uColor * 1.6 * fresnel * 0.35;             // warm edge glow
    col += vec3(caustic * 1.3, caustic * 0.75, 0.0);  // amber caustic

    // ── Alpha: opaque on edges and surface, transparent in the interior ─────
    float alpha = uOpacity
                + fresnel * 0.18
                + max(0.0, N.y) * 0.08;

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;
