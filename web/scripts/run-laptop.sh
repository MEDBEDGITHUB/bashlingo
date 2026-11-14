#!/usr/bin/env bash
# Запуск всего стека на своём ноутбуке: база, сайт, публичный HTTPS-туннель и Telegram-бот.
# Использование (Git Bash, из папки web):  bash scripts/run-laptop.sh      Остановка: Ctrl+C
#
# Туннель: бесплатный localhost.run по SSH (учётка не нужна). Адрес меняется при каждом запуске,
# скрипт сам записывает его в PUBLIC_URL и запускает бота, который ставит кнопку Mini App.
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_DIR="${NODE_DIR:-$LOCALAPPDATA/Programs/node-v26.13.1-win-x64}"
export PATH="$NODE_DIR:$PATH"
RUN=.run
mkdir -p "$RUN"
pids=()
cleanup() {
  echo; echo "Останавливаю..."
  for p in "${pids[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

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

# 3. Публичный туннель
ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes -T -R 80:127.0.0.1:3000 nokey@localhost.run >"$RUN/tunnel.log" 2>&1 &
pids+=($!)
URL=""
for _ in $(seq 1 30); do
  URL=$(sed 's/\x1b\[[0-9;]*m//g' "$RUN/tunnel.log" | grep -aoE 'https://[a-z0-9]+\.lhr\.life' | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done
[ -n "$URL" ] || { echo "Не удалось получить адрес туннеля, см. $RUN/tunnel.log"; exit 1; }
echo "Публичный адрес: $URL"

# 4. Бот (адрес меняется, поэтому PUBLIC_URL берём из туннеля, а не из .env)
export PUBLIC_URL="$URL"
# сайту нужен тот же адрес для ссылок «войти на другом устройстве»: перезапускаем его с новым PUBLIC_URL
kill "${pids[1]}" 2>/dev/null || true
node --env-file=.env node_modules/next/dist/bin/next start -p 3000 >"$RUN/web.log" 2>&1 &
pids[1]=$!
# Node не берёт прокси из окружения сам; без этого бот не достучится до Telegram за прокси
NODE_USE_ENV_PROXY=1 node --env-file=.env scripts/bot.mjs >"$RUN/bot.log" 2>&1 &
pids+=($!)
sleep 4
tail -n 2 "$RUN/bot.log"
echo; echo "Готово. Откройте @zurbash_bot в Telegram: рядом со строкой ввода будет кнопка Ҙурбаш."
echo "Админка: $URL/admin   Логи: web/$RUN/*.log   Остановка: Ctrl+C"
wait
