import { encodeCode39 } from '@/lib/barcode39';

export default function BarcodeSVG({ value, height = 60, barUnit = 2, showText = true, className = '' }) {
  const segments = encodeCode39(value);
  const totalUnits = segments.reduce((sum, s) => sum + s.width, 0);
  const width = totalUnits * barUnit;

  let x = 0;
  const bars = segments.map((seg, i) => {
    const w = seg.width * barUnit;
    const rect = seg.isBar ? (
      <rect key={i} x={x} y={0} width={w} height={height} fill="#000" />
    ) : null;
    x += w;
    return rect;
  });

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {bars}
      </svg>
      {showText && <span className="text-xs font-mono tracking-wider mt-0.5">{value}</span>}
    </div>
  );
}