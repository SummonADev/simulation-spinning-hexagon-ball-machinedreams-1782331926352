import React, { useState } from 'react';
import HexagonSimulation from '@/components/HexagonSimulation';
import Controls from '@/components/Controls';
import { Settings2, RefreshCw } from 'lucide-react';

export default function SimulationPage() {
  const [rotationSpeed, setRotationSpeed] = useState(0.02);
  const [gravity, setGravity] = useState(0.5);
  const [restitution, setRestitution] = useState(0.8);
  const [ballSize, setBallSize] = useState(15);
  const [resetKey, setResetKey] = useState(0);

  const handleReset = () => setResetKey(prev => prev + 1);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-950 overflow-hidden">
      {/* Sidebar Controls */}
      <aside className="w-full md:w-80 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-6 flex flex-col gap-6 z-10">
        <div className="flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold tracking-tight text-slate-100">HexaSim</h1>
        </div>

        <div className="text-xs text-slate-500 -mt-4 font-mono">
          Pure Canvas · Custom Physics
        </div>

        <Controls
          rotationSpeed={rotationSpeed}
          setRotationSpeed={setRotationSpeed}
          gravity={gravity}
          setGravity={setGravity}
          restitution={restitution}
          setRestitution={setRestitution}
          ballSize={ballSize}
          setBallSize={setBallSize}
        />

        <div className="mt-auto flex flex-col gap-3">
          <div className="rounded-lg bg-slate-800 p-3 text-xs font-mono text-slate-400 grid grid-cols-2 gap-y-1">
            <span className="text-slate-500">GRAVITY</span>
            <span className="text-cyan-400 text-right">{gravity.toFixed(2)} g</span>
            <span className="text-slate-500">RPM</span>
            <span className="text-cyan-400 text-right">{((rotationSpeed * 60 * 60) / (2 * Math.PI)).toFixed(1)}</span>
            <span className="text-slate-500">RESTITUTION</span>
            <span className="text-cyan-400 text-right">{restitution.toFixed(2)}</span>
            <span className="text-slate-500">BALL SIZE</span>
            <span className="text-cyan-400 text-right">{ballSize} px</span>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 transition-colors text-white font-semibold py-3 px-4 rounded-lg shadow-lg active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Simulation
          </button>
        </div>
      </aside>

      {/* Main Simulation Area */}
      <main className="flex-1 relative bg-slate-950 flex items-center justify-center">
        <HexagonSimulation
          key={resetKey}
          rotationSpeed={rotationSpeed}
          gravity={gravity}
          restitution={restitution}
          ballSize={ballSize}
        />
      </main>
    </div>
  );
}
