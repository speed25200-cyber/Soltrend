'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useCasino } from '@/lib/store';
import { SectionHead } from '@/components/SectionHead';
import { ConnectButton } from '@/components/ConnectButton';
import { Icon } from '@/components/Icon';
import { SolMark } from '@/components/BalanceWidget';
import { fmtSol, fmtMult, fmtCompact, shortAddr, timeAgo } from '@/lib/format';
import { creatorEarnings } from '@/lib/store';
import { vipFromWagered, levelFromXp } from '@/lib/progression';

export default function ProfilePage() {
  const { connected, publicKey } = useWallet();
  const history = useCasino((s) => s.history);
  const balance = useCasino((s) => s.balance);
  const progress = useCasino((s) => s.progress);
  const vip = vipFromWagered(progress.wageredTotal);
  const level = levelFromXp(progress.xp);

  const stats = useMemo(() => {
    const wagered = history.reduce((s, h) => s + h.bet, 0);
    const net = history.reduce((s, h) => s + (h.payout - h.bet), 0);
    const wins = history.filter((h) => h.win).length;
    const biggest = history.reduce((m, h) => Math.max(m, h.payout - h.bet), 0);
    return { wagered, net, wins, biggest, count: history.length };
  }, [history]);

  if (!connected) {
    return (
      <div className="glass grid place-items-center gap-4 p-16 text-center">
        <p className="text-slate-400">Connect your wallet to see your profile, history and limits.</p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-neon-violet to-neon-magenta font-display text-xl font-bold text-void-950">
          {publicKey?.toBase58().slice(0, 2).toUpperCase()}
        </span>
        <div className="flex-1">
          <div className="font-display text-xl font-bold text-white">{shortAddr(publicKey?.toBase58() ?? '', 6)}</div>
          <div className="text-sm text-slate-500">Balance ◎{fmtSol(balance)} · Level {level.level}</div>
        </div>
        <span className="chip" style={{ borderColor: `${vip.tier.color}55`, color: vip.tier.color }}>
          <Icon name={vip.tier.icon} size={12} /> {vip.tier.name} VIP
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Bets" value={String(stats.count)} />
        <StatTile label="Wagered" value={`◎${fmtSol(stats.wagered, 2)}`} />
        <StatTile label="Net P/L" value={`${stats.net >= 0 ? '+' : ''}${fmtSol(stats.net, 3)}`} tone={stats.net >= 0 ? 'win' : 'loss'} />
        <StatTile label="Biggest win" value={`◎${fmtSol(stats.biggest, 3)}`} />
      </div>

      <CreatorDashboard />

      <div className="grid gap-6 md:grid-cols-2">
        <ReferralPanel code={progress.referralCode} />
        <SettingsPanel />
      </div>

      <ResponsibleGaming />

      <div>
        <SectionHead eyebrow="Activity" title="Bet history" />
        {history.length === 0 ? (
          <div className="glass p-10 text-center text-sm text-slate-500">
            No bets yet — <Link href="/" className="text-neon-violet">hit the lobby</Link>.
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-white/[0.06] px-4 py-2.5 text-[0.65rem] uppercase tracking-wider text-slate-500 md:grid">
              <span>Game</span>
              <span className="text-right">Bet</span>
              <span className="text-right">Mult</span>
              <span className="text-right">Payout</span>
              <span className="text-right">Verify</span>
            </div>
            <div className="max-h-[28rem] divide-y divide-white/[0.04] overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto_auto_auto] md:gap-4">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{h.game}</div>
                    <div className="text-[0.65rem] text-slate-500">{timeAgo(h.ts)} · nonce {h.nonce}</div>
                  </div>
                  <div className="text-right font-mono text-slate-400">◎{fmtSol(h.bet, 3)}</div>
                  <div className={`hidden text-right font-mono md:block ${h.win ? 'text-win' : 'text-slate-500'}`}>
                    {fmtMult(h.multiplier)}
                  </div>
                  <div className={`text-right font-mono font-bold ${h.win ? 'text-win' : 'text-loss'}`}>
                    {h.win ? `+◎${fmtSol(h.payout - h.bet, 3)}` : `−◎${fmtSol(h.bet, 3)}`}
                  </div>
                  <div className="hidden text-right md:block">
                    <Link href={`/verify?server=${h.serverSeed}&client=${h.clientSeed}&nonce=${h.nonce}&game=${h.template}`} className="text-xs text-neon-violet hover:text-neon-magenta">
                      Verify →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: 'win' | 'loss' }) {
  return (
    <div className="stat-tile">
      <span className="label-eyebrow">{label}</span>
      <span className={`font-display text-lg font-bold ${tone === 'win' ? 'text-win' : tone === 'loss' ? 'text-loss' : 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}

function ResponsibleGaming() {
  const rg = useCasino((s) => s.rg);
  const setRg = useCasino((s) => s.setRg);
  const [maxBet, setMaxBet] = useState(rg.maxBet ?? '');
  const [dailyLoss, setDailyLoss] = useState(rg.dailyLossLimit ?? '');

  const excluded = rg.selfExcludedUntil && rg.selfExcludedUntil > Date.now();

  return (
    <div className="glass p-6">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-win/15 text-win">
          <Icon name="heart" size={16} />
        </span>
        <div>
          <h3 className="font-display font-bold text-white">Responsible gaming</h3>
          <p className="text-xs text-slate-500">First-class controls, not a footer. Limits apply instantly.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <LimitField
          label="Max bet per wager (SOL)"
          value={maxBet}
          onChange={setMaxBet}
          onApply={() => setRg({ maxBet: maxBet === '' ? null : Number(maxBet) })}
        />
        <LimitField
          label="Daily loss limit (SOL)"
          value={dailyLoss}
          onChange={setDailyLoss}
          onApply={() => setRg({ dailyLossLimit: dailyLoss === '' ? null : Number(dailyLoss) })}
        />
      </div>

      <div className="mt-5">
        <span className="label-eyebrow">Self-exclusion / cooling-off</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { label: '24 hours', ms: 86400000 },
            { label: '7 days', ms: 7 * 86400000 },
            { label: '30 days', ms: 30 * 86400000 },
          ].map((o) => (
            <button
              key={o.label}
              onClick={() => setRg({ selfExcludedUntil: Date.now() + o.ms })}
              className="btn-ghost !py-2 text-sm"
            >
              Exclude {o.label}
            </button>
          ))}
          {excluded && (
            <button onClick={() => setRg({ selfExcludedUntil: null })} className="chip !border-loss/40 !text-loss">
              Active until {new Date(rg.selfExcludedUntil!).toLocaleString()} · lift
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-void-900/50 p-4 text-sm">
        <span className="chip !border-gold/30 !text-gold">KYC · Not started</span>
        <p className="flex-1 text-slate-500">
          Verification unlocks large withdrawals and creator-royalty claims (via Sumsub). Play & small
          withdrawals stay no-KYC below the threshold.
        </p>
        <a className="text-neon-violet hover:text-neon-magenta" href="https://www.gamblingtherapy.org" target="_blank" rel="noreferrer">
          Get help
        </a>
      </div>
    </div>
  );
}

function LimitField({
  label,
  value,
  onChange,
  onApply,
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
  onApply: () => void;
}) {
  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>
      <div className="mt-1.5 flex gap-2">
        <input
          className="input-num"
          placeholder="No limit"
          value={value}
          inputMode="decimal"
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
        />
        <button className="btn-ghost" onClick={onApply}>
          Set
        </button>
      </div>
    </div>
  );
}

function CreatorDashboard() {
  const ugc = useCasino((s) => s.ugc);
  const claimedRoyalties = useCasino((s) => s.progress.claimedRoyalties);
  const claimRoyalties = useCasino((s) => s.claimRoyalties);
  const mine = ugc.filter((g) => g.mine);
  const earnings = creatorEarnings(ugc);
  const claimable = Math.max(0, Math.round((earnings - claimedRoyalties) * 10000) / 10000);
  const totalVolume = mine.reduce((s, g) => s + g.volume, 0);
  const [flash, setFlash] = useState('');

  return (
    <div className="glass p-6">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-neon-magenta/15 text-neon-magenta">
          <Icon name="pencil" size={16} />
        </span>
        <div>
          <h3 className="font-display font-bold text-white">Creator dashboard</h3>
          <p className="text-xs text-slate-500">Royalties from games you designed (30% of the house edge).</p>
        </div>
      </div>

      {mine.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-void-900/50 p-5 text-center text-sm text-slate-500">
          You haven’t published a game yet.{' '}
          <Link href="/studio" className="text-neon-violet">Open the Studio →</Link>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MiniStat label="Games" value={String(mine.length)} />
            <MiniStat label="Volume" value={`◎${fmtCompact(totalVolume)}`} />
            <MiniStat label="Royalties" value={`◎${fmtSol(earnings, 3)}`} accent />
          </div>
          <div className="mt-3 divide-y divide-white/[0.05] rounded-xl border border-white/[0.06]">
            {mine.map((g) => (
              <Link key={g.id} href={`/play/ugc?id=${g.id}`} className="flex items-center gap-3 p-3 text-sm hover:bg-white/[0.02]">
                <Icon name={g.theme.icon} size={18} />
                <span className="flex-1 truncate font-semibold text-white">{g.name}</span>
                <span className="font-mono text-xs text-slate-400">◎{fmtCompact(g.volume)} vol</span>
                <span className="font-mono text-xs text-gold">◎{fmtSol(g.volume * g.edge * 0.3, 3)}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              className="btn-primary flex-1"
              disabled={claimable <= 0}
              onClick={() => {
                const c = claimRoyalties();
                if (c > 0) setFlash(`Claimed ◎${fmtSol(c, 3)} to balance`);
              }}
            >
              {claimable > 0 ? `Claim ◎${fmtSol(claimable, 3)}` : 'Nothing to claim'}
            </button>
          </div>
          {flash && <p className="mt-2 text-center text-xs text-win">{flash}</p>}
          <p className="mt-3 text-[0.68rem] leading-relaxed text-slate-600">
            Claims require KYC on mainnet (enforced on-chain). This is a demo payout of accrued design royalties.
          </p>
        </>
      )}
    </div>
  );
}

function ReferralPanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== 'undefined' ? `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/?ref=${code}` : `?ref=${code}`;
  return (
    <div className="glass p-6">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-neon-cyan/15 text-neon-cyan">
          <Icon name="orbit" size={16} />
        </span>
        <div>
          <h3 className="font-display font-bold text-white">Refer & earn</h3>
          <p className="text-xs text-slate-500">You get a cut of the house edge from players you bring.</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="label-eyebrow">Your code</div>
        <div className="mt-1 font-display text-2xl font-bold text-white">{code}</div>
      </div>
      <button
        className="btn-ghost mt-3 w-full"
        onClick={() => {
          navigator.clipboard?.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'Link copied!' : 'Copy referral link'}
      </button>
    </div>
  );
}

function SettingsPanel() {
  const soundOn = useCasino((s) => s.soundOn);
  const setSoundOn = useCasino((s) => s.setSoundOn);
  return (
    <div className="glass p-6">
      <h3 className="font-display font-bold text-white">Settings</h3>
      <label className="mt-4 flex cursor-pointer items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-200">Sound effects</div>
          <div className="text-xs text-slate-500">Generative UI + win sounds</div>
        </div>
        <button
          onClick={() => setSoundOn(!soundOn)}
          className={`relative h-7 w-12 rounded-full transition ${soundOn ? 'bg-neon-violet' : 'bg-void-700'}`}
          aria-pressed={soundOn}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${soundOn ? 'left-6' : 'left-1'}`} />
        </button>
      </label>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3">
      <div className="label-eyebrow">{label}</div>
      <div className={`font-mono text-base font-bold ${accent ? 'text-gold' : 'text-white'}`}>{value}</div>
    </div>
  );
}
