import React from 'react';

type ControlsProps = {
  rotationSpeed: number;
  setRotationSpeed: (v: number) => void;
  gravity: number;
  setGravity: (v: number) => void;
  restitution: number;
  setRestitution: (v: number) => void;
  ballSize: number;
  setBallSize: (v: number) => void;
};

export default function Controls({
  rotationSpeed,
  setRotationSpeed,
  gravity,
  setGravity,
  restitution,
  setRestitution,
  ballSize,
  setBallSize
}: ControlsProps) {
  return (
    <div className="flex flex-col gap-5">
      <ControlItem 
        label="Rotation Speed"
        min={0}
        max={0.1}
        step={0.005}
        value={rotationSpeed}
        onChange={setRotationSpeed}
        suffix="rad/s"
      />
      
      <ControlItem 
        label="Gravity"
        min={-2}
        max={2}
        step={0.1}
        value={gravity}
        onChange={setGravity}
        suffix="g"
      />

      <ControlItem 
        label="Bounciness (Restitution)"
        min={0.1}
        max={1.2}
        step={0.1}
        value={restitution}
        onChange={setRestitution}
      />

      <ControlItem 
        label="Ball Size"
        min={5}
        max={40}
        step={1}
        value={ballSize}
        onChange={setBallSize}
        suffix="px"
      />
    </div>
  );
}

type ControlItemProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
};

function ControlItem({ label, min, max, step, value, onChange, suffix }: ControlItemProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="text-cyan-400 font-mono">{value.toFixed(2)}{suffix}</span>
      </div>
      <input 
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
      />
    </div>
  );
}