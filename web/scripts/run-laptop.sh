#!/usr/bin/env bash
# Запуск всего стека на своём ноутбуке: база, сайт, публичный HTTPS-туннель и Telegram-бот.
# Использование (Git Bash, из папки web):  bash scripts/run-laptop.sh      Остановка: Ctrl+C
#
# Туннель: бесплатный localhost.run по SSH (учётка не нужна). Он периодически меняет адрес сам:
# скрипт следит за логом туннеля и пишет актуальный адрес в .run/public_url, а бот каждые 20 секунд
# сверяется с этим файлом и переставляет кнопку Mini App.
set -uo pipefail
cd "$(dirname "$0")/.."

NODE_DIR="${NODE_DIR:-$LOCALAPPDATA/Programs/node-v26.13.1-win-x64}"
export PATH="$NODE_DIR:$PATH"
RUN=.run
mkdir -p "$RUN"
: > "$RUN/public_url"
pids=()
cleanup() {
  echo; echo "Останавливаю..."
  for p in "${pids[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null; done
  : > "$RUN/public_url"
}
trap cleanup EXIT INT TERM

latest_url() {
  sed 's/\x1b\[[0-9;]*m//g' "$RUN/tunnel.log" 2>/dev/null | grep -aoE 'https://[a-z0-9.]+\.lhr\.life' | tail -1
}

# 1. База
if ! bash scripts/pg-local.sh status >/dev/null 2>&1; then
  echo "Запускаю PostgreSQL..."
  bash scripts/pg-local.sh start >/dev/null
fi

# 2. Сайт (боевой режим; сборка, если ещё нет)
[ -f .next/BUILD_ID ] || npx next build
node --env-file=.env node_modules/next/dist/bin/next start -p 3000 >"$RUN/web.log" 2>&1 &
pids+=($!)
for _ in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:3000/welcome && break; sleep 1; done
echo "Сайт: http://localhost:3000"

# 3. Публичный туннель. Если SSH-сессия оборвалась, поднимаем её заново.
(
  while true; do
    ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
        -o ExitOnForwardFailure=yes -T -R 80:127.0.0.1:3000 nokey@localhost.run >>"$RUN/tunnel.log" 2>&1
    sleep 3
  done
) &
pids+=($!)
URL=""
for _ in $(seq 1 40); do
  URL=$(latest_url); [ -n "$URL" ] && break; sleep 1
done
[ -n "$URL" ] || { echo "Не удалось получить адрес туннеля, см. $RUN/tunnel.log"; exit 1; }
echo "$URL" > "$RUN/public_url"
echo "Публичный адрес: $URL"

# 4. Бот. Node не берёт прокси из окружения сам; без NODE_USE_ENV_PROXY бот за прокси не достучится до Telegram
NODE_USE_ENV_PROXY=1 node --env-file=.env scripts/bot.mjs >"$RUN/bot.log" 2>&1 &
pids+=($!)

# 5. Следим за сменой адреса туннеля
(
  last="$URL"
  while true; do
    sleep 10
    now=$(latest_url)
    if [ -n "$now" ] && [ "$now" != "$last" ]; then
      echo "$now" > "$RUN/public_url"
      echo "$(date +%T) Адрес туннеля сменился: $now"
      last="$now"
    fi
  done
) &
pids+=($!)

sleep 5
tail -n 3 "$RUN/bot.log"
echo; echo "Готово. Откройте @zurbash_bot в Telegram: рядом со строкой ввода будет кнопка Ҙурбаш."
echo "Админка: <публичный адрес>/admin   Логи: web/$RUN/*.log   Остановка: Ctrl+C"
wait
