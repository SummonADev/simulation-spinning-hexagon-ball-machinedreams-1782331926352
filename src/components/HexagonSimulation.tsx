import React, { useEffect, useRef } from 'react';
import Matter from 'matter-js';

type HexagonSimulationProps = {
  rotationSpeed: number;
  gravity: number;
  restitution: number;
  ballSize: number;
};

export default function HexagonSimulation({
  rotationSpeed,
  gravity,
  restitution,
  ballSize
}: HexagonSimulationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const { Engine, Render, Runner, Bodies, Composite, Events, Vector } = Matter;

    // Create engine
    const engine = Engine.create();
    engineRef.current = engine;
    engine.gravity.y = gravity;

    // Create renderer
    const render = Render.create({
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        background: 'transparent',
        wireframes: false,
        pixelRatio: window.devicePixelRatio || 1
      }
    });
    renderRef.current = render;

    // Simulation Parameters
    const centerX = containerRef.current.clientWidth / 2;
    const centerY = containerRef.current.clientHeight / 2;
    const hexRadius = Math.min(centerX, centerY) * 0.7;
    const wallThickness = 12;
    const sides = 6;

    // Build Hexagon
    const walls: Matter.Body[] = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;
      const x = centerX + hexRadius * Math.cos(angle);
      const y = centerY + hexRadius * Math.sin(angle);

      const wall = Bodies.rectangle(x, y, hexRadius * 1.05, wallThickness, {
        isStatic: true,
        angle: angle + Math.PI / 2,
        render: {
          fillStyle: '#22d3ee',
          strokeStyle: '#06b6d4',
          lineWidth: 2
        },
        friction: 0.1,
        restitution: 1
      });
      walls.push(wall);
    }

    // Create Ball
    const ball = Bodies.circle(centerX, centerY - 20, ballSize, {
      restitution: restitution,
      friction: 0.05,
      render: {
        fillStyle: '#f472b6',
        strokeStyle: '#ec4899',
        lineWidth: 3
      }
    });

    // Add to world
    Composite.add(engine.world, [...walls, ball]);

    // Animation Loop for Rotation
    let currentAngle = 0;
    Events.on(engine, 'beforeUpdate', () => {
      currentAngle += rotationSpeed;
      
      walls.forEach((wall, i) => {
        const baseAngle = (i * 2 * Math.PI) / sides;
        const dynamicAngle = baseAngle + currentAngle;
        
        const newX = centerX + hexRadius * Math.cos(dynamicAngle);
        const newY = centerY + hexRadius * Math.sin(dynamicAngle);
        
        // Update position and angle manually for static bodies to influence dynamic ones
        Matter.Body.setPosition(wall, { x: newX, y: newY });
        Matter.Body.setAngle(wall, dynamicAngle + Math.PI / 2);
        
        // Important: set velocity for collision physics transfer
        const velX = -hexRadius * Math.sin(dynamicAngle) * rotationSpeed;
        const velY = hexRadius * Math.cos(dynamicAngle) * rotationSpeed;
        Matter.Body.setVelocity(wall, { x: velX, y: velY });
      });

      // Constrain ball to stay within a reasonable bounds if it glitches out
      if (ball.position.y > containerRef.current!.clientHeight + 100 || ball.position.y < -100) {
         Matter.Body.setPosition(ball, { x: centerX, y: centerY });
         Matter.Body.setVelocity(ball, { x: 0, y: 0 });
      }
    });

    // Run the engine
    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);
    Render.run(render);

    // Handle Resize
    const handleResize = () => {
      if (!containerRef.current || !renderRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      render.canvas.width = width;
      render.canvas.height = height;
      render.options.width = width;
      render.options.height = height;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      Render.stop(render);
      Runner.stop(runner);
      Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
    };
  }, [ballSize, restitution]); // Re-init on ball changes, update others via state in events if needed

  // Update values that don't require full re-init
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.gravity.y = gravity;
    }
  }, [gravity]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex items-center justify-center"
    >
      <canvas ref={canvasRef} className="max-w-full max-h-full" />
    </div>
  );
}