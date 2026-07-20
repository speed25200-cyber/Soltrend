'use client';

import { useMemo, useState } from 'react';
import { useCasino, metricValue } from '@/lib/store';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { SolMark } from '@/components/BalanceWidget';
import { fmtSol, timeAgo } from '@/lib/format';
import {
  ACHIEVEMENTS,
  DAILY_MISSIONS,
  levelFromXp,
  vipFromWagered,
  VIP_TIERS,
} from '@/lib/progression';

export default function RewardsPage() {
  const progress = useCasino((s) => s.progress);
  const jackpot = useCasino((s) => s.jackpot);
  const jackpotWins = useCasino((s) => s.jackpotWins);
  const claimDaily = useCasino((s) => s.claimDaily);
  const claimMission = useCasino((s) => s.claimMission);

  const level = levelFromXp(progress.xp);
  const vip = vipFromWagered(progress.wageredTotal);
  const today = new Date().toISOString().slice(0, 10);
  const daily = progress.daily.day === today ? progress.daily : { ...progress.daily, day: today, bets: 0, wins: 0, wagered: 0, games: [], cashouts: 0, claimed: [] as string[] };
  const claimedToday = progress.lastDailyClaim === today;

  const [flash, setFlash] = useState<string | null>(null);
  const doDaily = () => {
    const b = claimDaily();
    if (b > 0) setFlash(`+◎${fmtSol(b)} daily bonus`);
  };

  return (
    <div className="space-y-8">
      <SectionHead eyebrow="Rewards" title="Your progress" sub="Level up, clear missions, climb the VIP ladder — and feed the community jackpot" />

      {flash && (
        <div className="glass flex items-center gap-2 border-win/30 p-3 text-sm text-win animate-float-up">
          <Icon name="check" size={16} /> {flash}
        </div>
      )}

      {/* Level + VIP */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-neon-violet to-neon-magenta font-display text-lg font-bold text-void-950">
              {level.level}
            </span>
            <div>
              <div className="font-display text-lg font-bold text-white">Level {level.level}</div>
              <div className="text-xs text-slate-500">{level.into} / {level.span} XP · {level.totalToNext} to next</div>
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-void-900">
            <div className="h-full rounded-full bg-gradient-to-r from-neon-violet via-neon-magenta to-neon-cyan transition-all" style={{ width: `${Math.max(3, level.pct * 100)}%` }} />
          </div>
        </div>

        <div className="glass p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ color: vip.tier.color, background: `${vip.tier.color}22` }}>
              <Icon name={vip.tier.icon} size={24} />
            </span>
            <div>
              <div className="font-display text-lg font-bold text-white">{vip.tier.name} VIP</div>
              <div className="text-xs text-slate-500">{vip.tier.rakeback}% rakeback{vip.next ? ` · ◎${fmtSol(vip.next.min - progress.wageredTotal, 1)} wagered to ${vip.next.name}` : ' · max tier'}</div>
            </div>
          </div>
          <div className="mt-4 flex gap-1">
            {VIP_TIERS.map((t) => (
              <div key={t.name} className="h-2.5 flex-1 rounded-full" style={{ background: progress.wageredTotal >= t.min ? t.color : 'rgba(255,255,255,0.06)' }} title={t.name} />
            ))}
          </div>
        </div>
      </div>

      {/* Daily bonus */}
      <div className="glass flex flex-col items-center gap-4 overflow-hidden p-6 sm:flex-row">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold">
          <Icon name="spark" size={28} />
        </span>
        <div className="flex-1 text-center sm:text-left">
          <div className="font-display text-lg font-bold text-white">Daily bonus</div>
          <div className="text-sm text-slate-500">
            Streak: <span className="font-semibold text-gold">{progress.streak} day{progress.streak === 1 ? '' : 's'}</span> · longer streak = bigger bonus (up to ◎0.70)
          </div>
        </div>
        <button className={`btn-primary ${claimedToday ? '!bg-none !border !border-white/10 !text-slate-500' : ''}`} disabled={claimedToday} onClick={doDaily}>
          {claimedToday ? 'Claimed today' : 'Claim daily bonus'}
        </button>
      </div>

      {/* Missions */}
      <section>
        <SectionHead eyebrow="Today" title="Daily missions" />
        <div className="grid gap-3 sm:grid-cols-2">
          {DAILY_MISSIONS.map((m) => {
            const val = Math.min(m.goal, metricValue(daily, m.metric));
            const done = val >= m.goal;
            const claimed = daily.claimed.includes(m.id);
            return (
              <div key={m.id} className="glass flex items-center gap-4 p-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{m.label}</span>
                    <span className="flex items-center gap-1 font-mono text-xs text-gold"><SolMark size={12} />{m.reward}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-void-900">
                    <div className={`h-full rounded-full ${done ? 'bg-win' : 'bg-neon-violet'}`} style={{ width: `${(val / m.goal) * 100}%` }} />
                  </div>
                  <div className="mt-1 text-[0.68rem] text-slate-500">{val} / {m.goal}</div>
                </div>
                <button
                  className={`btn-ghost !py-2 text-xs ${claimed ? 'opacity-40' : done ? '!border-win/40 !text-win' : ''}`}
                  disabled={!done || claimed}
                  onClick={() => claimMission(m.id)}
                >
                  {claimed ? 'Claimed' : done ? 'Claim' : 'Locked'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Jackpot */}
      <section className="glass relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative z-10 flex flex-col items-center gap-2 text-center">
          <span className="chip !border-gold/40 !text-gold">Community jackpot</span>
          <div className="font-display text-5xl font-bold text-gold" style={{ textShadow: '0 0 40px rgba(255,210,95,0.5)' }}>◎{fmtSol(jackpot, 2)}</div>
          <p className="max-w-md text-sm text-slate-500">A slice of every bet across Soltrend feeds this pot. Any spin can trigger it — the bigger your bet, the better your odds.</p>
        </div>
        {jackpotWins.length > 0 && (
          <div className="relative z-10 mt-5 divide-y divide-white/[0.05] border-t border-white/[0.06] pt-3">
            {jackpotWins.slice(0, 5).map((w, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-slate-300">{w.user} hit the jackpot</span>
                <span className="font-mono text-gold">◎{fmtSol(w.amount, 2)} · {timeAgo(w.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Achievements */}
      <section>
        <SectionHead eyebrow="Collection" title="Achievements" sub={`${progress.achievements.length} / ${ACHIEVEMENTS.length} unlocked`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const got = progress.achievements.includes(a.id);
            return (
              <div key={a.id} className={`glass p-4 ${got ? '' : 'opacity-55'}`}>
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${got ? 'bg-gold/15 text-gold' : 'bg-white/[0.03] text-slate-500'}`}>
                  <Icon name={a.icon} size={22} />
                </span>
                <div className="mt-2 font-display text-sm font-bold text-white">{a.label}</div>
                <div className="text-[0.68rem] text-slate-500">{a.desc}</div>
                {got && <div className="mt-1 text-[0.62rem] font-semibold uppercase tracking-wider text-win">Unlocked</div>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
