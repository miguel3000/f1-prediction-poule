import { getCircuitData } from '../utils/circuits';

interface CircuitBackgroundProps {
  circuitName?: string;
}

const CircuitBackground = ({ circuitName }: CircuitBackgroundProps) => {
  if (!circuitName) return null;
  const { path, viewBox } = getCircuitData(circuitName);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 w-full h-full"
        style={{ filter: 'blur(48px)', opacity: 0.07 }}
      >
        <path
          d={path}
          fill="none"
          stroke="#E6007E"
          strokeWidth="28"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

export default CircuitBackground;
