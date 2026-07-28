import Link from 'next/link';
import { Icon } from '@/components/Icon';

export default function NotFound() {
  return (
    <div className="glass mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-neon-violet/15 text-neon-violet">
        <Icon name="orbit" size={24} />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold text-white">Nothing here</h1>
      <p className="mt-2 text-sm text-slate-400">
        This page does not exist. A community game may also have been unpublished by its creator.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className="btn-primary">Back to the lobby</Link>
        <Link href="/discover" className="btn-ghost">Browse community games</Link>
      </div>
    </div>
  );
}
