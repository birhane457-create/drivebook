'use client';

/** Reusable meta-data table — grey box at top of every receipt */

interface Row {
  label: string;
  value: string;
  mono?: boolean;
}

export default function ReceiptMeta({ rows }: { rows: Row[] }) {
  return (
    <div className="bg-background rounded-xl border border-border px-4 py-3 print-light print-border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-0.5 text-muted-foreground/60 w-32 print-text-muted">{r.label}</td>
              <td className={`py-0.5 font-medium text-foreground print-text-dark ${r.mono ? 'font-mono text-xs' : ''}`}>
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
