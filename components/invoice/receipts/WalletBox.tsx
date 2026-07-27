'use client';

/** Reusable wallet-balance box used in several receipt types */

interface Row {
  label: string;
  value: string;
  color?: 'green' | 'red' | 'blue' | 'default';
}

interface Props {
  rows: Row[];
  /** The final "balance" row — larger, bolded */
  balanceLabel: string;
  balanceValue: string;
}

const COLOR_MAP: Record<string, string> = {
  green: 'text-emerald-400',
  red: 'text-red-400',
  blue: 'text-sky-400',
  default: 'text-slate-200',
};

export default function WalletBox({ rows, balanceLabel, balanceValue }: Props) {
  return (
    <div className="bg-sky-950/30 border border-sky-800/40 rounded-xl px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-widest text-sky-400 mb-2">Wallet Balance</p>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="py-0.5 text-slate-400">{r.label}</td>
              <td className={`py-0.5 text-right font-medium ${COLOR_MAP[r.color ?? 'default']}`}>{r.value}</td>
            </tr>
          ))}
          <tr className="border-t border-sky-800/40">
            <td className="pt-2 font-bold text-slate-100">{balanceLabel}</td>
            <td className="pt-2 text-right font-bold text-sky-400 text-base">{balanceValue}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
