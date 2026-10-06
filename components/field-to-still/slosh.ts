import * as THREE from 'three';

/*
 * A real-time liquid surface, after Evan Wallace's "WebGL Water" (MIT).
 *
 * The surface is a grid of heights. Each step, a cell that's higher than its
 * neighbours pushes liquid towards them, and liquid that's moving keeps
 * moving. That's all it takes for waves to travel, bounce off the glass,
 * cross each other and slowly die away.
 *
 * Wallace's pool solves the plain wave equation. A bottle also gets shoved
 * about, which a plain wave equation can't feel, so this uses its close cousin,
 * the linear shallow-water equations: alongside the heights it tracks how
 * fast liquid flows between neighbouring cells. Shoving the bottle pushes that
 * flow, the glass walls stop it, and the liquid piles up against one side.
 */

const GRAVITY = 9.81; // m/s²
const CELL = 0.0015; // m: each cell is 1.5mm square
const SLOSH_FREQUENCY = 19; // rad/s: the main back-and-forth slosh, ~3 a second
const DAMPING = 4; // per second: how quickly the motion dies away (a slosh settles in about a second)
// s: a stability limit. The waves (about 0.5 m/s) mustn't cross more than
// about a cell per step; this keeps them to three quarters of one.
const MAX_STEP = 1.5 / 1000;
const MAX_HEIGHT = 0.02; // m: however hard it's shaken, waves stay inside the bottle
const MAX_PUSH = 25; // m/s²: a hard shake, about 2.5g

// Viscosity, roughly: each step, every cell eases this far towards its
// neighbours' average. Ripples a few cells wide flatten within a fraction of
// a second; the big slosh, many cells long, barely notices. (Per step, so it
// goes with MAX_STEP: 0.04 a millisecond.)
const SMOOTHING = 0.06;
// When nothing's moving the bottle and its surface is this still (both its
// heights and its flows), it's asleep: there's nothing to simulate.
const STILL_HEIGHT = 2e-6; // m
const STILL_FLOW = 2e-6; // m/s
const STILL_PUSH = 0.02; // m/s²
const STILL_SPIN = 0.01; // rad/s
const STILL_SPIN_RATE = 0.1; // rad/s²

export class SloshField {
  /** Cells across the bottle's thin side (x) and long side (z) */
  readonly nx: number;
  readonly nz: number;
  /** Surface height of each cell above the resting level, in metres */
  readonly height: Float32Array;
  /** The heights, as a texture the liquid shader can read */
  readonly texture: THREE.DataTexture;

  private readonly halfX: number;
  private readonly halfZ: number;
  private readonly wet: Uint8Array; // 1 inside the bottle, 0 outside
  private readonly flowX: Float32Array; // flow across each cell's x faces
  private readonly flowZ: Float32Array; // flow across each cell's z faces
  private readonly depth: number;
  private readonly scratch: Float32Array;
  private readonly pixels: Uint16Array;
  private asleep = false;

  /**
   * @param width the inside of the bottle across x, in metres
   * @param length the inside of the bottle across z (the long side), in metres
   */
  constructor(width: number, length: number) {
    this.nx = Math.max(8, Math.round(width / CELL));
    this.nz = Math.max(8, Math.round(length / CELL));
    this.halfX = width / 2;
    this.halfZ = length / 2;
    const { nx, nz } = this;

    this.height = new Float32Array(nx * nz);
    this.flowX = new Float32Array((nx + 1) * nz);
    this.flowZ = new Float32Array(nx * (nz + 1));
    this.scratch = new Float32Array(nx * nz);

    // The flask's cross-section: a rectangle with well-rounded corners.
    this.wet = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = ((i + 0.5) / nx) * 2 - 1;
        const z = ((j + 0.5) / nz) * 2 - 1;
        this.wet[j * nx + i] = x ** 4 + z ** 4 <= 1 ? 1 : 0;
      }
    }

    // Waves travel at √(g·depth). Choosing the depth sets the speed, and the
    // speed sets the slosh frequency: one wave there and back along the bottle.
    const speed = (SLOSH_FREQUENCY * length) / Math.PI;
    this.depth = (speed * speed) / GRAVITY;

    // Half-float (16-bit) heights: GPUs can smoothly blend between those.
    this.pixels = new Uint16Array(nx * nz);
    this.texture = new THREE.DataTexture(this.pixels, nx, nz, THREE.RedFormat, THREE.HalfFloatType);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
  }

  /**
   * Advance the liquid by `dt` seconds.
   *
   * The bottle's motion arrives in the bottle's own frame (x across, z along):
   * @param ax,az how fast the bottle's centre is speeding up, in m/s²
   * @param spin how fast it's turning about its upright axis, in rad/s
   * @param spinRate how fast that turning is speeding up, in rad/s²
   */
  step(dt: number, ax: number, az: number, spin: number, spinRate: number) {
    const { clamp } = THREE.MathUtils;
    ax = clamp(ax, -MAX_PUSH, MAX_PUSH);
    az = clamp(az, -MAX_PUSH, MAX_PUSH);
    spinRate = clamp(spinRate, -MAX_PUSH / this.halfZ, MAX_PUSH / this.halfZ);

    // Asleep (settled, and nothing's moving it)? Then it stays exactly as it is.
    const still =
      Math.abs(ax) < STILL_PUSH &&
      Math.abs(az) < STILL_PUSH &&
      Math.abs(spin) < STILL_SPIN &&
      Math.abs(spinRate) < STILL_SPIN_RATE;
    if (still && this.asleep) return;

    // Small steps keep it stable: a wave mustn't cross more than a cell per step.
    const steps = Math.ceil(dt / MAX_STEP);
    for (let s = 0; s < steps; s++) this.substep(dt / steps, ax, az, spin, spinRate);
    this.upload();
    this.asleep = still && this.settled();
  }

  /** Whether the surface has come to rest: flat, and nothing flowing. */
  private settled() {
    const { height, flowX, flowZ } = this;
    for (let c = 0; c < height.length; c++) if (Math.abs(height[c]) > STILL_HEIGHT) return false;
    for (let f = 0; f < flowX.length; f++) if (Math.abs(flowX[f]) > STILL_FLOW) return false;
    for (let f = 0; f < flowZ.length; f++) if (Math.abs(flowZ[f]) > STILL_FLOW) return false;
    return true;
  }

  private substep(dt: number, ax: number, az: number, spin: number, spinRate: number) {
    const { nx, nz, height, wet, flowX, flowZ, depth, halfX, halfZ } = this;
    const fade = Math.exp(-DAMPING * dt);
    const spin2 = spin * spin;

    // 1. Flow. Between two wet cells, liquid speeds up downhill. In a bottle
    //    that's accelerating, "downhill" also leans away from the push: the
    //    liquid lags behind, like coffee surging forward when you brake.
    //    Turning adds two more pushes: speeding up the turn drags the liquid
    //    sideways (tangential), and turning at all flings it outwards (centripetal).
    for (let j = 0; j < nz; j++) {
      const z = ((j + 0.5) / nz) * 2 * halfZ - halfZ;
      for (let i = 1; i < nx; i++) {
        const a = j * nx + i - 1;
        const b = a + 1;
        const f = j * (nx + 1) + i;
        if (!wet[a] || !wet[b]) {
          flowX[f] = 0; // glass: nothing flows through it
          continue;
        }
        const x = (i / nx) * 2 * halfX - halfX;
        const push = ax + spinRate * z - spin2 * x;
        flowX[f] = (flowX[f] - ((GRAVITY * (height[b] - height[a])) / CELL + push) * dt) * fade;
      }
    }
    for (let j = 1; j < nz; j++) {
      const z = (j / nz) * 2 * halfZ - halfZ;
      for (let i = 0; i < nx; i++) {
        const a = (j - 1) * nx + i;
        const b = a + nx;
        const f = j * nx + i;
        if (!wet[a] || !wet[b]) {
          flowZ[f] = 0;
          continue;
        }
        const x = ((i + 0.5) / nx) * 2 * halfX - halfX;
        const push = az - spinRate * x - spin2 * z;
        flowZ[f] = (flowZ[f] - ((GRAVITY * (height[b] - height[a])) / CELL + push) * dt) * fade;
      }
    }

    // 2. Height. Whatever flows into a cell raises it; whatever flows out lowers it.
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        if (!wet[c]) continue;
        const inX = flowX[j * (nx + 1) + i] - flowX[j * (nx + 1) + i + 1];
        const inZ = flowZ[j * nx + i] - flowZ[(j + 1) * nx + i];
        height[c] += ((depth * (inX + inZ)) / CELL) * dt;
      }
    }

    // 3. Viscosity: ease each cell towards the average of its wet neighbours.
    const { scratch } = this;
    scratch.set(height);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        if (!wet[c]) continue;
        let sum = 0;
        let count = 0;
        if (i > 0 && wet[c - 1]) {
          sum += scratch[c - 1];
          count++;
        }
        if (i < nx - 1 && wet[c + 1]) {
          sum += scratch[c + 1];
          count++;
        }
        if (j > 0 && wet[c - nx]) {
          sum += scratch[c - nx];
          count++;
        }
        if (j < nz - 1 && wet[c + nx]) {
          sum += scratch[c + nx];
          count++;
        }
        if (count) height[c] += (sum / count - scratch[c]) * SMOOTHING;
      }
    }
  }

  /**
   * Disturb the surface, like something dropping in.
   * @param x,z where, in metres from the centre, in the bottle's frame
   * @param radius how wide the splash is, in metres
   * @param strength how far it pushes the surface down, in metres
   */
  drop(x: number, z: number, radius: number, strength: number) {
    const { nx, nz, height, wet, halfX, halfZ } = this;
    this.asleep = false;
    let pushed = 0;
    let wetCells = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        if (!wet[c]) continue;
        wetCells++;
        const dx = ((i + 0.5) / nx) * 2 * halfX - halfX - x;
        const dz = ((j + 0.5) / nz) * 2 * halfZ - halfZ - z;
        const d = Math.hypot(dx, dz) / radius;
        if (d >= 1) continue;
        const dip = strength * 0.5 * (1 + Math.cos(Math.PI * d)); // a smooth dimple
        height[c] -= dip;
        pushed += dip;
      }
    }
    // The liquid pushed aside has to go somewhere: spread it back over the
    // whole surface, so even a steady stream never sinks the level.
    if (!wetCells) return;
    const rise = pushed / wetCells;
    for (let c = 0; c < height.length; c++) if (wet[c]) height[c] += rise;
  }

  /** The surface height at a point (metres from the centre, bottle's frame), for floating things. */
  heightAt(x: number, z: number) {
    const { clamp } = THREE.MathUtils;
    const i = clamp(Math.floor(((x + this.halfX) / (2 * this.halfX)) * this.nx), 0, this.nx - 1);
    const j = clamp(Math.floor(((z + this.halfZ) / (2 * this.halfZ)) * this.nz), 0, this.nz - 1);
    return this.height[j * this.nx + i];
  }

  /**
   * Copy the heights into the texture. Cells just outside the glass borrow
   * from their neighbour towards the centre, so the texture's blending
   * doesn't drag the waterline down to zero at the walls.
   */
  private upload() {
    const { nx, nz, height, wet, pixels } = this;
    const { clamp } = THREE.MathUtils;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        let value = height[c];
        if (!wet[c]) {
          const ci = i + Math.sign(nx / 2 - i - 0.5);
          const cj = j + Math.sign(nz / 2 - j - 0.5);
          value = height[cj * nx + ci];
        }
        pixels[c] = THREE.DataUtils.toHalfFloat(clamp(value, -MAX_HEIGHT, MAX_HEIGHT));
      }
    }
    this.texture.needsUpdate = true;
  }
}
