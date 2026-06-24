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
const SUBSTEPS = 12;
const FRICTION = 0.12;

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

function resolveWallCollision(
  vel: Vec2,
  inwardNormal: Vec2,
  wallVel: Vec2,
  restitution: number,
  friction: number
): Vec2 {
  const relVel = sub(vel, wallVel);
  const vn = dot(relVel, inwardNormal);
  if (vn >= 0) return vel;

  // Normal impulse
  const jn = -(1 + restitution) * vn;
  const afterNormal: Vec2 = { x: relVel.x + inwardNormal.x * jn, y: relVel.y + inwardNormal.y * jn };

  // Tangential friction impulse
  const tangent = perp(inwardNormal);
  const vt = dot(afterNormal, tangent);
  const maxFriction = friction * Math.abs(jn);
  const jt = Math.max(-maxFriction, Math.min(maxFriction, -vt));
  const afterFriction: Vec2 = { x: afterNormal.x + tangent.x * jt, y: afterNormal.y + tangent.y * jt };

  return add(wallVel, afterFriction);
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
    const dpr = window.devicePixelRatio || 1;

    let W = container.clientWidth;
    let H = container.clientHeight;

    function resizeCanvas() {
      W = container!.clientWidth;
      H = container!.clientHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = W + 'px';
      canvas!.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();

    // Trail history
    const MAX_TRAIL = 40;
    const trail: Vec2[] = [];

    // State
    let hexAngle = 0;
    let ballPos: Vec2 = { x: W / 2, y: H / 2 - 50 };
    let ballVel: Vec2 = { x: 2, y: 0 };

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
    const FIXED_DT = 1 / 60;
    const subDt = FIXED_DT / SUBSTEPS;

    function physicsStep() {
      const cx = W / 2;
      const cy = H / 2;
      const hexRadius = Math.min(cx, cy) * 0.72;
      const ballR = ballSizeRef.current;
      const g = gravityRef.current;
      const rot = rotSpeedRef.current;
      const rest = restitutionRef.current;

      // Rotate hexagon
      hexAngle += rot * subDt * TWO_PI;

      // Apply gravity (pixels/s²  scaled for feel)
      ballVel = add(ballVel, { x: 0, y: g * 9.8 * subDt });

      // Move ball
      ballPos = add(ballPos, scale(ballVel, subDt));

      const verts = hexVertices(cx, cy, hexRadius, hexAngle);

      for (let i = 0; i < SIDES; i++) {
        const v0 = verts[i];
        const v1 = verts[(i + 1) % SIDES];

        const edge = sub(v1, v0);
        const edgeLen = length(edge);
        if (edgeLen < 1e-8) continue;
        const edgeDir = normalize(edge);
        const wallNormal = perp(edgeDir); // CCW perp

        // Inward normal: must point toward the center
        const midPoint: Vec2 = { x: (v0.x + v1.x) / 2, y: (v0.y + v1.y) / 2 };
        const toCenter = sub({ x: cx, y: cy }, midPoint);
        const inward = dot(toCenter, wallNormal) >= 0 ? wallNormal : scale(wallNormal, -1);

        // Closest point on segment to ball
        const toBall = sub(ballPos, v0);
        const proj = Math.max(0, Math.min(edgeLen, dot(toBall, edgeDir)));
        const closest: Vec2 = add(v0, scale(edgeDir, proj));

        const diff = sub(ballPos, closest);
        const dist = length(diff);

        // Only collide if ball is on the outer side (outside the wall from center's perspective)
        // i.e., the ball has penetrated through the inward normal side
        const signedDist = dot(sub(ballPos, closest), inward);

        if (signedDist < ballR) {
          const penetration = ballR - signedDist;
          // Push ball inward
          ballPos = add(ballPos, scale(inward, penetration + 0.01));

          // Wall surface velocity at closest point (tangential due to rotation)
          const r_vec = sub(closest, { x: cx, y: cy });
          const angVelRad = rot * TWO_PI; // radians per second
          const wallVel: Vec2 = {
            x: -r_vec.y * angVelRad,
            y: r_vec.x * angVelRad
          };

          ballVel = resolveWallCollision(ballVel, inward, wallVel, rest, FRICTION);
        }
      }

      // Safety reset
      const distFromCenter = length(sub(ballPos, { x: cx, y: cy }));
      if (distFromCenter > hexRadius * 1.5) {
        ballPos = { x: cx, y: cy - 30 };
        ballVel = { x: 1, y: 0 };
      }
    }

    function drawScene() {
      const cx = W / 2;
      const cy = H / 2;
      const hexRadius = Math.min(cx, cy) * 0.72;
      const ballR = ballSizeRef.current;

      ctx.clearRect(0, 0, W, H);

      // Background
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
      bg.addColorStop(0, '#0f1e3a');
      bg.addColorStop(1, '#020617');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const verts = hexVertices(cx, cy, hexRadius, hexAngle);

      // Hex glow outer
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < SIDES; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 36;
      ctx.strokeStyle = 'rgba(34,211,238,0.12)';
      ctx.lineWidth = 28;
      ctx.stroke();
      ctx.restore();

      // Hex fill
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < SIDES; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      ctx.fillStyle = 'rgba(8, 18, 40, 0.60)';
      ctx.fill();
      ctx.restore();

      // Hex border gradient
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < SIDES; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      const grad = ctx.createLinearGradient(cx - hexRadius, cy, cx + hexRadius, cy);
      grad.addColorStop(0, '#22d3ee');
      grad.addColorStop(0.33, '#818cf8');
      grad.addColorStop(0.66, '#38bdf8');
      grad.addColorStop(1, '#06b6d4');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#818cf8';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();

      // Vertex dots
      for (const v of verts) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(v.x, v.y, 5.5, 0, TWO_PI);
        ctx.fillStyle = '#67e8f9';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.restore();
      }

      // Ball trail
      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const alpha = (i / trail.length) * 0.55;
          const r = ballR * (i / trail.length) * 0.75;
          ctx.save();
          ctx.beginPath();
          ctx.arc(trail[i].x, trail[i].y, Math.max(r, 1), 0, TWO_PI);
          ctx.fillStyle = `rgba(236,72,153,${alpha})`;
          ctx.fill();
          ctx.restore();
        }
      }

      // Ball glow
      ctx.save();
      ctx.shadowColor = '#f472b6';
      ctx.shadowBlur = 30;
      const ballGrad = ctx.createRadialGradient(
        ballPos.x - ballR * 0.3,
        ballPos.y - ballR * 0.3,
        ballR * 0.08,
        ballPos.x,
        ballPos.y,
        ballR
      );
      ballGrad.addColorStop(0, '#fce7f3');
      ballGrad.addColorStop(0.4, '#f472b6');
      ballGrad.addColorStop(1, '#9d174d');
      ctx.beginPath();
      ctx.arc(ballPos.x, ballPos.y, ballR, 0, TWO_PI);
      ctx.fillStyle = ballGrad;
      ctx.fill();
      ctx.restore();

      // Ball specular highlight
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        ballPos.x - ballR * 0.3,
        ballPos.y - ballR * 0.3,
        ballR * 0.3,
        0, TWO_PI
      );
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fill();
      ctx.restore();

      // Speed indicator (velocity vector)
      const speed = length(ballVel);
      if (speed > 0.5) {
        const dir = normalize(ballVel);
        const arrowLen = Math.min(speed * 3, 60);
        ctx.save();
        ctx.strokeStyle = 'rgba(250,204,21,0.7)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(ballPos.x, ballPos.y);
        ctx.lineTo(ballPos.x + dir.x * arrowLen, ballPos.y + dir.y * arrowLen);
        ctx.stroke();
        ctx.restore();
      }
    }

    function loop(ts: number) {
      animRef.current = requestAnimationFrame(loop);

      if (lastTime === null) { lastTime = ts; }
      let dt = (ts - lastTime) / 1000;
      lastTime = ts;
      if (dt > 0.05) dt = 0.05;
      accumulator += dt;

      while (accumulator >= FIXED_DT) {
        for (let s = 0; s < SUBSTEPS; s++) {
          physicsStep();
        }
        // Record trail at lower frequency
        trail.push({ x: ballPos.x, y: ballPos.y });
        if (trail.length > MAX_TRAIL) trail.shift();
        accumulator -= FIXED_DT;
      }

      drawScene();
    }

    animRef.current = requestAnimationFrame(loop);

    const handleResize = () => {
      resizeCanvas();
      const cx = W / 2;
      const cy = H / 2;
      ballPos = { x: cx, y: cy - 50 };
      ballVel = { x: 2, y: 0 };
      trail.length = 0;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
