-- Ҙурбаш (Zurbash): схема данных (PostgreSQL 13+)

CREATE TABLE IF NOT EXISTS units (
  slug      text PRIMARY KEY,
  title     text NOT NULL,
  icon      text,
  position  int  NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  slug      text PRIMARY KEY,
  unit_slug text NOT NULL REFERENCES units(slug),
  title     text NOT NULL,
  position  int  NOT NULL
);

-- Фрагмент: башкирский текст + исходный перевод + координаты источника (ТЗ п.5)
CREATE TABLE IF NOT EXISTS fragments (
  id               text PRIMARY KEY,
  text_ba          text NOT NULL,
  lang_pair        text NOT NULL DEFAULT 'ba-ru',
  translation_auto text NOT NULL,
  source           jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_fragments (
  lesson_slug text NOT NULL REFERENCES lessons(slug),
  fragment_id text NOT NULL REFERENCES fragments(id),
  position    int  NOT NULL,
  PRIMARY KEY (lesson_slug, fragment_id)
);

CREATE TABLE IF NOT EXISTS schools (
  id   serial PRIMARY KEY,
  name text NOT NULL,
  city text
);

CREATE TABLE IF NOT EXISTS classes (
  id        serial PRIMARY KEY,
  school_id int  NOT NULL REFERENCES schools(id),
  name      text NOT NULL,
  join_code text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  level       smallint NOT NULL CHECK (level BETWEEN 1 AND 5),
  lang_pair   text NOT NULL DEFAULT 'ba-ru',
  class_id    int REFERENCES classes(id),
  streak      int NOT NULL DEFAULT 0,
  last_active date,
  telegram_id bigint UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xp_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     int  NOT NULL,
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xp_events_user_time ON xp_events (user_id, created_at);

-- Учтённые прохождения: ключ урока или 'daily:YYYY-MM-DD'. Повтор не даёт опыт.
CREATE TABLE IF NOT EXISTS completions (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        text NOT NULL,
  mistakes   int  NOT NULL DEFAULT 0,
  xp         int  NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS answers (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fragment_id text NOT NULL REFERENCES fragments(id),
  exercise    text NOT NULL,
  correct     boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS answers_fragment ON answers (fragment_id);

-- «В переводе ошибка?»: причина и, если есть, свой вариант
CREATE TABLE IF NOT EXISTS reports (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fragment_id text NOT NULL REFERENCES fragments(id),
  reason      text NOT NULL,
  proposed    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_fragment ON reports (fragment_id);

CREATE TABLE IF NOT EXISTS assignments (
  id          serial PRIMARY KEY,
  class_id    int  NOT NULL REFERENCES classes(id),
  title       text NOT NULL,
  lesson_slug text NOT NULL REFERENCES lessons(slug),
  due_date    date NOT NULL
);
