import { redirect } from 'next/navigation';
import { currentUser, LEVELS } from '@/lib/user';
import { one } from '@/lib/db';
import { normCode } from '@/lib/codes';
import Onboarding from './Onboarding';

export const dynamic = 'force-dynamic';

export default async function Welcome({ searchParams }) {
  const user = await currentUser();
  if (user) redirect(user.role === 'teacher' ? '/teacher' : '/');
  const sp = await searchParams;
  const code = normCode(sp?.code);
  const invite = code
    ? await one(
        `SELECT c.name AS class_name, s.name AS school_name FROM classes c JOIN schools s ON s.id = c.school_id WHERE c.join_code = $1`,
        [code]
      )
    : null;
  return (
    <main className="app bare">
      <div className="hero">
        <div className="brand">Ҙурбаш</div>
        <img src="/wave-out.png" alt="Куница машет лапой" />
      </div>
      <Onboarding levels={LEVELS} initialCode={invite ? code : ''} invite={invite} />
    </main>
  );
}
