import React from "react";
import { useV2Studio } from "../state/useV2Studio";

interface Props {
  x: number;
  y: number;
  leftModId: string;
  rightModId: string;
}

export const SeamToggleWidget: React.FC<Props> = ({ x, y, leftModId, rightModId }) => {
  const seams = useV2Studio((s) => s.seams);
  const toggleSeam = useV2Studio((s) => s.toggleSeam);

  const key = `${leftModId}-${rightModId}`;
  // default is true (shared 16mm)
  const isShared = seams[key] ?? true;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      className="cursor-pointer select-none"
      onClick={(e) => {
        e.stopPropagation();
        toggleSeam(leftModId, rightModId);
      }}
    >
      {/* Large Invisible Hit Area for Easy Touch on Mobile / iPad */}
      <circle r={24} fill="transparent" />

      {/* Outer Pulse Glow */}
      <circle
        r={14}
        fill={isShared ? "#10B981" : "#F59E0B"}
        opacity={0.25}
        className="transition-all hover:scale-125 animate-pulse"
      />

      {/* Main Interactive Dot */}
      <circle
        r={8}
        fill={isShared ? "#10B981" : "#F59E0B"}
        stroke="#FFFFFF"
        strokeWidth={2}
        className="transition-transform duration-150 active:scale-75 shadow-lg"
      />

      {/* Badge Tooltip Label */}
      <g transform="translate(0, -22)">
        <rect
          x={-28}
          y={-11}
          width={56}
          height={20}
          rx={5}
          fill="#0f172a"
          stroke={isShared ? "#10B981" : "#F59E0B"}
          strokeWidth={1.5}
        />
        <text
          textAnchor="middle"
          y={3}
          fill="#f8fafc"
          fontSize={10}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {isShared ? "16 мм" : "32 мм"}
        </text>
      </g>
    </g>
  );
};
