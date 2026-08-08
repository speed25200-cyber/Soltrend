'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCasino, creatorEarnings } from '@/lib/store';
import { SectionHead } from '@/components/SectionHead';
import { Icon } from '@/components/Icon';
import { fmtSol, fmtCompact } from '@/lib/format';
import { useOnchainVault } from '@/hooks/useOnchainVault';
import { studioLink } from '@/lib/studio/kinds';

/**
 * "My games" — everything a creator owns, in the section where they built it.
 * This used to live at the bottom of the profile page, which was unintuitive
 * enough that the studio had to carry a hint pointing people there.
 */


export default function MyGamesPage() {
  const ugc = useCasino((s) => s.ugc);
  const claimedRoyalties = useCasino((s) => s.progress.claimedRoyalties);
  const claimRoyalties = useCasino((s) => s.claimRoyalties);
  const deleteUgc = useCasino((s) => s.deleteUgc);
  const mine = ugc.filter((g) => g.mine);
  const earnings = creatorEarnings(ugc);
  const claimable = Math.max(0, Math.round((earnings - claimedRoyalties) * 10000) / 10000);
  const totalVolume = mine.reduce((s, g) => s + g.volume, 0);
  const [flash, setFlash] = useState('');
  const [claiming, setClaiming] = useState(false);
  const chain = useOnchainVault();

  return (
    <div className="space-y-6">
      <SectionHead eyebrow="Create · My games" title="Everything you've published" sub="Edit, duplicate or unpublish your games, and claim the royalties they earn." />
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
            {mine.map((g) => {
              const editHref = studioLink(g, 'edit');
              const dupHref = studioLink(g, 'remix');
              return (
                <div key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 text-sm">
                  <Link href={`/play/ugc?id=${g.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
                    <Icon name={g.theme.icon} size={18} />
                    <span className="truncate font-semibold text-white">{g.name}</span>
                  </Link>
                  <span className="font-mono text-xs text-slate-400">◎{fmtCompact(g.volume)} vol</span>
                  <span className="font-mono text-xs text-gold">◎{fmtSol(g.volume * g.edge * 0.3, 3)}</span>
                  {editHref && dupHref && (
                    <div className="flex items-center gap-1">
                      <Link href={editHref} className="chip hover:border-neon-cyan/50 !text-[0.68rem]" title="Edit this game in the studio">Edit</Link>
                      <Link href={dupHref} className="chip hover:border-neon-violet/50 !text-[0.68rem]" title="Duplicate into a new game">Duplicate</Link>
                      <button
                        onClick={() => { if (window.confirm(`Unpublish "${g.name}"? This removes it from the community.`)) deleteUgc(g.id); }}
                        className="chip hover:border-loss/50 hover:text-loss !text-[0.68rem]"
                        title="Unpublish (delete) this game"
                      >
                        Unpublish
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              className="btn-primary flex-1"
              disabled={claimable <= 0 || claiming}
              onClick={async () => {
                if (chain.enabled) {
                  setClaiming(true);
                  try {
                    const sig = await chain.claimRoyalties();
                    claimRoyalties(); // mirror locally so the dashboard reflects the claim
                    setFlash(`Claimed on-chain · ${sig.slice(0, 8)}…`);
                  } catch (e) {
                    setFlash(e instanceof Error ? e.message : 'Claim failed');
                  } finally {
                    setClaiming(false);
                  }
                  return;
                }
                const c = claimRoyalties();
                if (c > 0) setFlash(`Claimed ◎${fmtSol(c, 3)} to balance`);
              }}
            >
              {claiming ? 'Confirming…' : claimable > 0 ? `Claim ◎${fmtSol(claimable, 3)}` : 'Nothing to claim'}
            </button>
          </div>
          {flash && <p className="mt-2 break-all text-center text-xs text-win">{flash}</p>}
          <p className="mt-3 text-[0.68rem] leading-relaxed text-slate-600">
            {chain.enabled
              ? 'Claims are signed by your wallet and paid from your on-chain creator vault. Mainnet claims require KYC (enforced on-chain).'
              : 'Claims require KYC on mainnet (enforced on-chain). This is a demo payout of accrued design royalties.'}
          </p>
        </>
      )}
    </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-void-900/50 p-3 text-center">
      <div className="label-eyebrow">{label}</div>
      <div className={`font-mono text-sm font-bold ${accent ? 'text-gold' : 'text-white'}`}>{value}</div>
    </div>
  );
}
