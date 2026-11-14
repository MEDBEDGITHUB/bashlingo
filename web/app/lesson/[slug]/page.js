import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/user';
import { getLesson, lessonFragments, dailyFragments, distractorPool, buildExercises } from '@/lib/course';
import { todayKey } from '@/lib/progress';
import { REASONS } from '@/lib/reasons';
import Lesson from './Lesson';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }) {
  const { slug } = await params;
  const user = await currentUser();
  if (!user) redirect('/welcome');

  let title;
  let kicker;
  let frags;
  let pool;
  if (slug === 'daily') {
    title = 'Задание дня';
    kicker = 'Задание дня';
    frags = await dailyFragments(user.level, todayKey());
    pool = await distractorPool(null);
  } else {
    const lesson = await getLesson(slug);
    if (!lesson) notFound();
    title = lesson.title;
    kicker = `${lesson.unit_title} · урок ${lesson.position + 1} из ${lesson.unit_lessons}`;
    frags = await lessonFragments(slug);
    pool = await distractorPool(slug);
  }
  const exercises = buildExercises(frags, pool);
  return (
    <main className="app bare">
      <Lesson slug={slug} title={title} kicker={kicker} exercises={exercises} reasons={REASONS} />
    </main>
  );
}
