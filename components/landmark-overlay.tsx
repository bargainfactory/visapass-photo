'use client';

import * as React from 'react';
import type { FaceAnalysis } from '@/lib/face-landmarker';
import type { CropRect } from '@/lib/crop-calculator';

interface LandmarkOverlayProps {
  imageWidth: number;
  imageHeight: number;
  face?: FaceAnalysis | null;
  crop?: CropRect | null;
  showLandmarks?: boolean;
  showCrop?: boolean;
}

export function LandmarkOverlay({
  imageWidth,
  imageHeight,
  face,
  crop,
  showLandmarks = true,
  showCrop = true,
}: LandmarkOverlayProps) {
  if (!imageWidth || !imageHeight) return null;
  return (
    <svg
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      {face && (
        <g>
          {showLandmarks &&
            face.landmarks.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={Math.max(1.5, imageWidth / 800)} fill="rgba(53,120,245,0.55)" />
            ))}
          <rect
            x={face.box.x}
            y={face.box.y}
            width={face.box.w}
            height={face.box.h}
            fill="none"
            stroke="rgba(53,120,245,0.9)"
            strokeWidth={Math.max(2, imageWidth / 600)}
            rx={8}
          />
          <line
            x1={face.box.x}
            x2={face.box.x + face.box.w}
            y1={face.eyeLine.y}
            y2={face.eyeLine.y}
            stroke="rgba(34,197,94,0.85)"
            strokeWidth={Math.max(1.2, imageWidth / 900)}
            strokeDasharray="6 6"
          />
        </g>
      )}
      {crop && showCrop && (
        <rect
          x={crop.x}
          y={crop.y}
          width={crop.width}
          height={crop.height}
          fill="none"
          stroke="rgba(245,158,11,0.95)"
          strokeWidth={Math.max(2, imageWidth / 500)}
          strokeDasharray="14 6"
          rx={6}
        />
      )}
    </svg>
  );
}
