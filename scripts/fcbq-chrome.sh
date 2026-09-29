#!/usr/bin/env bash
# Start/stop a persistent Google Chrome profile for FCBQ calendar scrapes.
# reCAPTCHA v3 scores well only when Chrome is a real process (not puppeteer.launch).
# Connect with puppeteer-core over CDP (see fetch-fcbq-fixtures-browser.mjs).
set -euo pipefail

PROFILE="${FCBQ_CHROME_PROFILE:-${HOME}/.cache/fcbq-chrome}"
PORT="${FCBQ_CDP_PORT:-9335}"
LOG="${FCBQ_CHROME_LOG:-/tmp/fcbq-chrome.log}"
PIDFILE="${FCBQ_CHROME_PIDFILE:-${PROFILE}/chrome.pid}"
DISPLAY_NUM="${FCBQ_XVFB_DISPLAY:-:94}"

CHROME_BIN="${FCBQ_CHROME_BIN:-}"
if [[ -z "$CHROME_BIN" ]]; then
  for c in google-chrome-stable google-chrome chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1; then
      CHROME_BIN="$(command -v "$c")"
      break
    fi
  done
fi
if [[ -z "${CHROME_BIN}" || ! -x "${CHROME_BIN}" ]]; then
  echo "fcbq-chrome: no Chrome/Chromium binary found" >&2
  exit 1
fi

mkdir -p "$PROFILE"
cd "$PROFILE"

is_up() {
  curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1
}

stop_xvfb() {
  if [[ -f "${PROFILE}/xvfb.pid" ]]; then
    kill "$(cat "${PROFILE}/xvfb.pid")" 2>/dev/null || true
    rm -f "${PROFILE}/xvfb.pid"
  fi
}

ensure_display() {
  if [[ -n "${DISPLAY:-}" && -S "/tmp/.X11-unix/X${DISPLAY#:}" ]]; then
    return 0
  fi
  if ! command -v Xvfb >/dev/null 2>&1; then
    echo "fcbq-chrome: need DISPLAY or Xvfb" >&2
    exit 1
  fi
  export DISPLAY="$DISPLAY_NUM"
  if [[ ! -S "/tmp/.X11-unix/X${DISPLAY#:}" ]]; then
    Xvfb "$DISPLAY" -screen 0 1400x1000x24 -ac -nolisten tcp \
      >"${PROFILE}/xvfb.log" 2>&1 &
    echo $! >"${PROFILE}/xvfb.pid"
    sleep 0.5
  fi
}

start() {
  if is_up; then
    echo "fcbq-chrome: already up on :${PORT}"
    return 0
  fi
  ensure_display
  # Drop stale singleton locks if a previous crash left them behind.
  rm -f "${PROFILE}/SingletonLock" "${PROFILE}/SingletonCookie" "${PROFILE}/SingletonSocket" 2>/dev/null || true

  # Launch as a normal Chrome process (no --enable-automation).
  nohup "$CHROME_BIN" \
    --no-sandbox \
    --test-type \
    --disable-dev-shm-usage \
    --use-gl=angle \
    --use-angle=swiftshader-webgl \
    --enable-unsafe-swiftshader \
    --password-store=basic \
    --no-first-run \
    --no-default-browser-check \
    --disable-blink-features=AutomationControlled \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port="${PORT}" \
    --user-data-dir="${PROFILE}" \
    --window-size=1400,1000 \
    about:blank \
    >"$LOG" 2>&1 &
  echo $! >"$PIDFILE"

  for _ in $(seq 1 40); do
    if is_up; then
      echo "fcbq-chrome: ready :${PORT} profile=${PROFILE}"
      return 0
    fi
    sleep 0.25
  done
  echo "fcbq-chrome: failed to start (see ${LOG})" >&2
  exit 1
}

stop() {
  if [[ -f "$PIDFILE" ]]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
  # Fallback: kill by port if still listening.
  if is_up; then
    pkill -f "remote-debugging-port=${PORT}" 2>/dev/null || true
  fi
  stop_xvfb
  echo "fcbq-chrome: stopped"
}

status() {
  if is_up; then
    curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/json/version"
    echo
    echo "profile=${PROFILE}"
    exit 0
  fi
  echo "fcbq-chrome: down"
  exit 1
}

case "${1:-}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  restart) stop; start ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}" >&2
    exit 2
    ;;
esac
