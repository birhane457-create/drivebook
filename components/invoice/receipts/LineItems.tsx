'use client';

/** Reusable line-item breakdown table */

interface Line {
  label: string;
  value: string;
  color?: 'default' | 'green' | 'red' | 'muted' | 'accent';
  bold?: boolean;
  divider?: boolean; // renders a horizontal rule above this row
}

const COLOR_MAP: Record<string, string> = {
  default: 'text-slate-200',
  green:   'text-emerald-400',
  red:     'text-red-400',
  muted:   'text-slate-500',
  accent:  'text-sky-400',
};

export default function LineItems({ lines, total }: { lines: Line[]; total: { label: string; value: string; accentColor?: string } }) {
  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden print-light print-border">
      <table className="w-full text-sm">
        <tbody>
          {lines.map((line, i) => (
            <>
              {line.divider && (
                <tr key={`div-${i}`}>
                  <td colSpan={2} className="px-4">
                    <hr className="border-slate-800" />
                  </td>
                </tr>
              )}
              <tr key={i}>
                <td className={`px-4 py-2 text-slate-400 print-text-muted ${line.bold ? 'font-semibold' : ''}`}>
                  {line.label}
                </td>
                <td className={`px-4 py-2 text-right ${COLOR_MAP[line.color ?? 'default']} ${line.bold ? 'font-semibold' : ''}`}>
                  {line.value}
                </td>
              </tr>
            </>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-700">
            <td className="px-4 py-3 font-bold text-slate-100 text-base print-text-dark">{total.label}</td>
            <td
              className="px-4 py-3 text-right font-bold text-xl print-accent"
              style={total.accentColor ? { color: total.accentColor } : {}}
            >
              {total.value}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
