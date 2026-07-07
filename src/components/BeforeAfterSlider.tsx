import { useState, useRef, useCallback } from 'react';

interface BeforeAfterSliderProps {
  beforeImage: string; // base64 or blob url
  afterImage: string;  // base64 or blob url
}

const getSrc = (src: string) => src.startsWith('blob:') || src.startsWith('data:') ? src : `data:image/png;base64,${src}`;

export default function BeforeAfterSlider({ beforeImage, afterImage, className, imgClassName }: BeforeAfterSliderProps & { className?: string, imgClassName?: string }) {
  const [position, setPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const getPositionFromEvent = useCallback((clientX: number) => {
    if (!containerRef.current) return position;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    return pct;
  }, [position]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition(getPositionFromEvent(e.clientX));
    },
    [isDragging, getPositionFromEvent]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      setPosition(getPositionFromEvent(touch.clientX));
    },
    [isDragging, getPositionFromEvent]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className={className || "relative rounded-gcard overflow-hidden shadow-lg select-none inline-block"}
      style={{ touchAction: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* After image (bottom layer) */}
      <img
        src={getSrc(afterImage)}
        alt="After"
        className={`w-auto h-auto object-contain block ${imgClassName || ''}`}
        draggable={false}
      />

      {/* Before image (top layer, clipped) */}
      <img
        src={getSrc(beforeImage)}
        alt="Before"
        className={`w-full h-full object-cover absolute top-0 left-0 ${imgClassName || ''}`}
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        draggable={false}
      />

      {/* Draggable handle */}
      <div
        className="absolute top-0 bottom-0"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Vertical bar */}
        <div className="w-1 h-full bg-white shadow-md cursor-ew-resize" />

        {/* Circle grip */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full border-2 border-gborder-300 shadow-lg flex items-center justify-center cursor-ew-resize"
        >
          <span className="material-symbols-outlined text-gtext-500 text-sm">drag_handle</span>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded">
        Before
      </div>
      <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded">
        After
      </div>
    </div>
  );
}
