import BarcodeSVG from '@/components/labels/BarcodeSVG';

export default function PrintLabelsSheet({ items }) {
  const labels = items.flatMap(item =>
    Array.from({ length: item.quantity || 1 }, (_, i) => ({ ...item, _copy: i }))
  );

  return (
    <div className="hidden print:grid print:grid-cols-3 print:gap-4 print:p-4">
      {labels.map((label, idx) => (
        <div key={`${label.id}-${idx}`} className="border border-black flex flex-col items-center justify-center p-3 break-inside-avoid">
          <p className="text-xs font-semibold text-center mb-1">{label.display_text}</p>
          <BarcodeSVG value={label.barcode_value} height={50} barUnit={1.5} />
        </div>
      ))}
    </div>
  );
}