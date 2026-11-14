import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/user';
import { one } from '@/lib/db';
import { normCode } from '@/lib/codes';
import JoinClass from '../../class/JoinClass';

export const dynamic = 'force-dynamic';

// Ссылка-приглашение в класс: /join/КОД. Новый ученик попадает на регистрацию с подставленным кодом,
// уже зарегистрированный подтверждает вступление кнопкой.
export default async function Join({ params }) {
  const { code: raw } = await params;
  const code = normCode(decodeURIComponent(raw));
  const user = await currentUser();
  if (!user) redirect(`/welcome?code=${encodeURIComponent(code)}`);
  if (user.role === 'teacher') redirect('/teacher');
  const cls = await one(
    `SELECT c.id, c.name, s.name AS school FROM classes c JOIN schools s ON s.id = c.school_id WHERE c.join_code = $1`,
    [code]
  );
  if (cls && cls.id === user.class_id) redirect('/class');
  return (
    <main className="app bare">
      <div className="hero"><img src="/wave-out.png" alt="" /></div>
      <div className="page-pad">
        {cls ? (
          <>
            <h1 className="h1">Вступить в класс {cls.name}?</h1>
            <p className="lead">{cls.school}.{user.class_name ? ` Сейчас вы в классе ${user.class_name}: вы перейдёте из него в новый.` : ''}</p>
            <JoinClass initial={code} locked />
          </>
        ) : (
          <>
            <h1 className="h1">Класс не найден</h1>
            <p className="lead">Проверьте ссылку или попросите у учителя код класса.</p>
          </>
        )}
        <Link href="/" className="back" style={{ display: 'block', marginTop: 16, textAlign: 'center' }}>На главную</Link>
      </div>
    </main>
  );
}
