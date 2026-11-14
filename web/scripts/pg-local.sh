#!/usr/bin/env bash
# Локальный PostgreSQL без установки службы (порт 5433, данные в web/.pgdata).
# Использование: scripts/pg-local.sh init|start|stop|status
set -euo pipefail
cd "$(dirname "$0")/.."
PG_BIN="${PG_BIN:-$LOCALAPPDATA/Programs/pgsql/bin}"
DATA=".pgdata"
PORT=5433

case "${1:-}" in
  init)
    [ -d "$DATA" ] && { echo "Уже инициализировано: $DATA"; exit 0; }
    PW=$(grep '^PG_SUPERUSER_PASSWORD=' .env | cut -d= -f2-)
    PWFILE=$(mktemp); printf '%s' "$PW" > "$PWFILE"
    "$PG_BIN/initdb" -D "$DATA" -U postgres --pwfile="$PWFILE" -A scram-sha-256 -E UTF8 --locale=C >/dev/null
    rm -f "$PWFILE"
    echo "port = $PORT" >> "$DATA/postgresql.conf"
    echo "listen_addresses = 'localhost'" >> "$DATA/postgresql.conf"
    echo "Готово: $DATA"
    ;;
  start)  "$PG_BIN/pg_ctl" -D "$DATA" -l "$DATA/server.log" -w start ;;
  stop)   "$PG_BIN/pg_ctl" -D "$DATA" -w stop ;;
  status) "$PG_BIN/pg_ctl" -D "$DATA" status ;;
  *) echo "scripts/pg-local.sh init|start|stop|status"; exit 1 ;;
esac
