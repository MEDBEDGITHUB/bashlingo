import { redirect } from 'next/navigation';
import { currentUser, LEVELS } from '@/lib/user';
import Onboarding from './Onboarding';

export const dynamic = 'force-dynamic';

export default async function Welcome() {
  if (await currentUser()) redirect('/');
  return (
    <main className="app bare">
      <div className="hero">
        <img src="/wave-out.png" alt="Куница машет лапой" />
      </div>
      <Onboarding levels={LEVELS} />
    </main>
  );
}
