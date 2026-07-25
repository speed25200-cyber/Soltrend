import { VOLATILITY, playRound, MAX_WIN, type Volatility } from '/home/user/Soltrend/apps/web/src/lib/slots/goldmine.ts';
function rng(seed: number) { let a = seed >>> 0; return () => { a=(a+0x6d2b79f5)>>>0; let t=a;
  t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
const N = 2_000_000;
const out: Record<string, unknown> = {};
for (const k of ['steady','balanced','wild'] as Volatility[]) {
  const base = VOLATILITY[k].build();
  const r = rng(0x5107);
  let sum = 0, sumSq = 0, caps = 0, best = 0;
  for (let i = 0; i < N; i++) {
    const v = playRound(r, { ...base, payScale: 1 }).total;
    sum += v; sumSq += v * v;
    if (v >= MAX_WIN - 1e-9) caps++;
    if (v > best) best = v;
  }
  const rtp1 = sum / N;
  const sd = Math.sqrt(sumSq / N - rtp1 * rtp1);
  const se = sd / Math.sqrt(N);
  const rows: string[] = [];
  for (const t of [0.02, 0.03, 0.04]) {
    const scale = Math.round(((1 - t) / rtp1) * 10000) / 10000;
    // 3-sigma on the EDGE after scaling: scale * 3 * se
    const half = 3 * se * scale;
    rows.push(`  target ${(t*100).toFixed(0)}% -> scale ${scale}  edge ${(t*100).toFixed(2)}% +/- ${(half*100).toFixed(2)}pp  [${((t-half)*100).toFixed(2)}%..${((t+half)*100).toFixed(2)}%] ${t-half>=0.01 && t+half<=0.05 ? 'SAFE' : 'RISKY'}`);
  }
  console.log(`${k}: rtp@1=${rtp1.toFixed(5)} sd=${sd.toFixed(2)} caps=${caps} best=${best.toFixed(0)}x`);
  rows.forEach((x) => console.log(x));
  console.log();
}
