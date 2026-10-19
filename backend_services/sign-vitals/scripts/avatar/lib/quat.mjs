// Quaternion helpers. Quaternions are [x, y, z, w]; vectors are [x, y, z].

export const IDENTITY = [0, 0, 0, 1];

// three.js Euler order 'XYZ' (what kalidokit's own demo uses), radians.
export function eulerXYZToQuat({ x = 0, y = 0, z = 0 }) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

// A local rotation in VRM 0.x normalized space (character faces -Z) expressed
// in VRM 1.0 normalized space (character faces +Z): conjugate by a 180° turn
// about Y, which negates x and z.
export function vrm0ToVrm1([x, y, z, w]) {
  return [-x, y, -z, w];
}

export function mul(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export const conj = ([x, y, z, w]) => [-x, -y, -z, w];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

export function normalize(q) {
  const n = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

export function rotate(q, v) {
  const p = mul(mul(q, [v[0], v[1], v[2], 0]), conj(q));
  return [p[0], p[1], p[2]];
}

export function slerp(a, b, t) {
  let d = dot(a, b);
  let bb = b;
  if (d < 0) { d = -d; bb = b.map((c) => -c); }
  if (d > 0.9995) return normalize(a.map((c, i) => c + (bb[i] - c) * t));
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((c, i) => c * wa + bb[i] * wb);
}

// Angle in degrees between two orientations.
export function angleDeg(a, b) {
  return (2 * Math.acos(Math.min(1, Math.abs(dot(normalize(a), normalize(b))))) * 180) / Math.PI;
}

// Rotation matrix (row-major 3x3, or the 3x3 part of a 4x4) to quaternion.
export function fromMatrix(m) {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m;
  const tr = m00 + m11 + m22;
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  return normalize(q);
}

// Flip signs so neighbouring frames sit in the same hemisphere (q and -q are
// the same rotation); filters and slerp assume this.
export function makeContinuous(seq) {
  const out = [];
  for (const q of seq) {
    if (q === null) { out.push(null); continue; }
    const prev = out.findLast((p) => p !== null);
    out.push(prev && dot(prev, q) < 0 ? q.map((c) => -c) : q);
  }
  return out;
}

// Zero-phase smoothing: a slerp EMA run forwards then backwards, so the
// filter's lag cancels and movements keep their timing. alpha = weight of the
// new sample (1 = no smoothing).
export function smoothZeroPhase(seq, alpha) {
  const pass = (s) => {
    const out = [s[0]];
    for (let i = 1; i < s.length; i++) out.push(normalize(slerp(out[i - 1], s[i], alpha)));
    return out;
  };
  return makeContinuous(pass(pass(seq).reverse()).reverse());
}

// Jitter = mean angle (degrees) between each frame and the midpoint of its two
// neighbours, i.e. how far the motion departs from locally smooth movement.
export function jitterDeg(seq) {
  let sum = 0, n = 0;
  for (let i = 1; i < seq.length - 1; i++) {
    sum += angleDeg(seq[i], slerp(seq[i - 1], seq[i + 1], 0.5));
    n++;
  }
  return n ? sum / n : 0;
}

export const round4 = (arr) => arr.map((v) => Math.round(v * 1e4) / 1e4);
