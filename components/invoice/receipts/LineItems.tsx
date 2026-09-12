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
  default: 'text-foreground',
  green:   'text-emerald-400',
  red:     'text-destructive',
  muted:   'text-muted-foreground/60',
  accent:  'text-primary',
};

export default function LineItems({ lines, total }: { lines: Line[]; total: { label: string; value: string; accentColor?: string } }) {
  return (
    <div className="bg-background rounded-xl border border-border overflow-hidden print-light print-border">
      <table className="w-full text-sm">
        <tbody>
          {lines.map((line, i) => (
            <>
              {line.divider && (
                <tr key={`div-${i}`}>
                  <td colSpan={2} className="px-4">
                    <hr className="border-border" />
                  </td>
                </tr>
              )}
              <tr key={i}>
                <td className={`px-4 py-2 text-muted-foreground print-text-muted ${line.bold ? 'font-semibold' : ''}`}>
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
          <tr className="border-t-2 border-border">
            <td className="px-4 py-3 font-bold text-foreground text-base print-text-dark">{total.label}</td>
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
