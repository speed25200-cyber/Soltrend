export function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <span className="label-eyebrow">{eyebrow}</span>
      <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
      {sub && <p className="text-sm text-slate-500">{sub}</p>}
    </div>
  );
}
