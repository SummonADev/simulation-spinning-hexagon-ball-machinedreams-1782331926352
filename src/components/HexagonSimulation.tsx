import React, { useEffect, useRef } from 'react';

type Vec2 = { x: number; y: number };

type HexagonSimulationProps = {
  rotationSpeed: number;
  gravity: number;
  restitution: number;
  ballSize: number;
};

const TWO_PI = Math.PI * 2;
const SIDES = 6;
const SUBSTEPS = 8;
const FIXED_DT = 1 / 60;

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

function length(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len < 1e-10) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function perp(v: Vec2): Vec2 {
  return { x: -v.y, y: v.x };
}

// Reflect velocity off a normal, with restitution and friction
function resolveWallCollision(
  vel: Vec2,
  normal: Vec2,
  wallVel: Vec2,
  restitution: number,
  friction: number
): Vec2 {
  const relVel = sub(vel, wallVel);
  const vn = dot(relVel, normal);
  if (vn >= 0) return vel; // separating, skip

  // Normal impulse
  const normalImpulse = -(1 + restitution) * vn;
  const afterNormal = add(relVel, scale(normal, normalImpulse));

  // Tangent friction
  const tangent = perp(normal);
  const vt = dot(afterNormal, tangent);
  const frictionImpulse = -friction * Math.abs(normalImpulse);
  const clampedFriction = Math.max(-Math.abs(vt), Math.min(Math.abs(vt), frictionImpulse));
  const afterTangent = add(afterNormal, scale(tangent, Math.sign(vt) * clampedFriction));

  return add(wallVel, afterTangent);
}

export default function HexagonSimulation({
  rotationSpeed,
  gravity,
  restitution,
  ballSize
}: HexagonSimulationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  // Mutable refs for live-updated params (no restart needed)
  const rotSpeedRef = useRef(rotationSpeed);
  const gravityRef = useRef(gravity);
  const restitutionRef = useRef(restitution);
  const ballSizeRef = useRef(ballSize);

  useEffect(() => { rotSpeedRef.current = rotationSpeed; }, [rotationSpeed]);
  useEffect(() => { gravityRef.current = gravity; }, [gravity]);
  useEffect(() => { restitutionRef.current = restitution; }, [restitution]);
  useEffect(() => { ballSizeRef.current = ballSize; }, [ballSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d')!;

    // ---- sizing ----
    let W = container.clientWidth;
    let H = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    // ---- state ----
    let hexAngle = 0;
    let ballPos: Vec2 = { x: W / 2, y: H / 2 - 40 };
    let ballVel: Vec2 = { x: 1.5, y: 0 };

    // Build hex vertices at angle
    function hexVertices(cx: number, cy: number, r: number, angle: number): Vec2[] {
      const verts: Vec2[] = [];
      for (let i = 0; i < SIDES; i++) {
        const a = angle + (i * TWO_PI) / SIDES;
        verts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      return verts;
    }

    let lastTime: number | null = null;
    let accumulator = 0;

    function loop(ts: number) {
      animRef.current = requestAnimationFrame(loop);

      if (lastTime === null) { lastTime = ts; }
      let dt = (ts - lastTime) / 1000;
      lastTime = ts;
      // clamp to avoid spiral of death
      if (dt > 0.05) dt = 0.05;
      accumulator += dt;

      const cx = W / 2;
      const cy = H / 2;
      const hexRadius = Math.min(cx, cy) * 0.72;
      const ballRadius = ballSizeRef.current;

      // Fixed-timestep physics
      const subDt = FIXED_DT / SUBSTEPS;
      while (accumulator >= FIXED_DT) {
        for (let s = 0; s < SUBSTEPS; s++) {
          // Rotate hex
          hexAngle += rotSpeedRef.current * subDt * 60;

          // Gravity
          ballVel = add(ballVel, { x: 0, y: gravityRef.current * 0.5 * subDt * 60 });

          // Move ball
          ballPos = add(ballPos, scale(ballVel, subDt * 60));

          // Collision detection with each hex wall
          const verts = hexVertices(cx, cy, hexRadius, hexAngle);
          const prevHexAngle = hexAngle - rotSpeedRef.current * subDt * 60;

          for (let i = 0; i < SIDES; i++) {
            const v0 = verts[i];
            const v1 = verts[(i + 1) % SIDES];

            const edge = sub(v1, v0);
            const edgeLen = length(edge);
            const edgeDir = normalize(edge);
            const wallNormal = normalize(perp(edge)); // inward if CCW winding

            // Project ball center onto the edge line
            const toBall = sub(ballPos, v0);
            const proj = dot(toBall, edgeDir);
            const clampedProj = Math.max(0, Math.min(edgeLen, proj));
            const closest: Vec2 = add(v0, scale(edgeDir, clampedProj));

            const diff = sub(ballPos, closest);
            const dist = length(diff);

            // Determine which side: inward normal should point toward center
            const toCenter = sub({ x: cx, y: cy }, closest);
            const inward = dot(toCenter, wallNormal) > 0 ? wallNormal : scale(wallNormal, -1);

            if (dist < ballRadius) {
              // Push ball inside
              const penetration = ballRadius - dist;
              const pushDir = dist < 1e-6 ? inward : normalize(diff);
              // Make sure pushDir points inward
              const pushInward = dot(pushDir, inward) > 0 ? pushDir : scale(pushDir, -1);
              ballPos = add(ballPos, scale(pushInward, penetration + 0.1));

              // Wall velocity at contact point (rotating wall)
              const r_vec = sub(closest, { x: cx, y: cy });
              const wallAngVel = rotSpeedRef.current * 60 / (TWO_PI) * TWO_PI; // rad per frame * 60fps
              const wallVel: Vec2 = {
                x: -r_vec.y * rotSpeedRef.current * 60,
                y: r_vec.x * rotSpeedRef.current * 60
              };

              ballVel = resolveWallCollision(
                ballVel,
                pushInward,
                wallVel,
                restitutionRef.current,
                0.15
              );
            }
          }

          // Safety: if ball escapes the hex entirely, reset
          const distFromCenter = length(sub(ballPos, { x: cx, y: cy }));
          if (distFromCenter > hexRadius + ballSizeRef.current * 4) {
            ballPos = { x: cx, y: cy - 20 };
            ballVel = { x: 0, y: 0 };
          }
        }
        accumulator -= FIXED_DT;
      }

      // ---- DRAW ----
      ctx.clearRect(0, 0, W, H);

      // Background glow
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(cx, cy));
      bg.addColorStop(0, '#0f172a');
      bg.addColorStop(1, '#020617');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const verts = hexVertices(cx, cy, hexRadius, hexAngle);

      // Hex glow shadow
      ctx.save();
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < SIDES; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(34,211,238,0.18)';
      ctx.lineWidth = 24;
      ctx.stroke();
      ctx.restore();

      // Hex fill (semi-transparent)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < SIDES; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fill();
      ctx.restore();

      // Hex border
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < SIDES; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      const grad = ctx.createLinearGradient(cx - hexRadius, cy - hexRadius, cx + hexRadius, cy + hexRadius);
      grad.addColorStop(0, '#22d3ee');
      grad.addColorStop(0.5, '#818cf8');
      grad.addColorStop(1, '#06b6d4');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      // Vertex dots
      for (const v of verts) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(v.x, v.y, 5, 0, TWO_PI);
        ctx.fillStyle = '#67e8f9';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      }

      // Ball shadow
      ctx.save();
      const ballGrad = ctx.createRadialGradient(
        ballPos.x - ballSizeRef.current * 0.3,
        ballPos.y - ballSizeRef.current * 0.3,
        ballSizeRef.current * 0.1,
        ballPos.x,
        ballPos.y,
        ballSizeRef.current
      );
      ballGrad.addColorStop(0, '#f9a8d4');
      ballGrad.addColorStop(0.6, '#ec4899');
      ballGrad.addColorStop(1, '#9d174d');
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, ballSizeRef.current, 0, TWO_PI);
      ctx.fillStyle = ballGrad;
      ctx.fill();
      ctx.restore();

      // Ball shine
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        ballPos.x - ballSizeRef.current * 0.28,
        ballPos.y - ballSizeRef.current * 0.28,
        ballSizeRef.current * 0.32,
        0,
        TWO_PI
      );
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();
      ctx.restore();
    }

    animRef.current = requestAnimationFrame(loop);

    // Resize
    const handleResize = () => {
      if (!container) return;
      W = container.clientWidth;
      H = container.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.scale(dpr, dpr);
      // Re-center ball
      ballPos = { x: W / 2, y: H / 2 - 40 };
      ballVel = { x: 1.5, y: 0 };
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [ballSize, restitution]); // re-init when structural props change

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
