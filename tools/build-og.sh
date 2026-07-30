#!/usr/bin/env bash
# Captura tools/og-template.html a assets/icons/og-image.png (1200x630).
#
# Necesita un Chromium/Chrome headless y un servidor local: la plantilla usa
# rutas relativas y las fuentes web no cargan desde file://.
#
# Uso:  ./tools/build-og.sh [ruta-a-chrome]
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUERTO=8791
SALIDA="$RAIZ/assets/icons/og-image.png"

CHROME="${1:-}"
if [[ -z "$CHROME" ]]; then
  for candidato in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "$HOME/Library/Caches/ms-playwright/chromium-"*/chrome-mac/Chromium.app/Contents/MacOS/Chromium \
    "$(command -v chromium || true)" \
    "$(command -v google-chrome || true)"; do
    [[ -x "$candidato" ]] && CHROME="$candidato" && break
  done
fi
if [[ ! -x "${CHROME:-}" ]]; then
  echo "No encontré Chrome/Chromium. Pásalo como argumento." >&2
  exit 1
fi

python3 -m http.server "$PUERTO" --directory "$RAIZ" >/dev/null 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null || true' EXIT
sleep 1

TMP="$(mktemp -d)"
rm -f "$SALIDA"

# Chrome headless no siempre termina solo tras --screenshot, así que se lanza
# en segundo plano y se corta en cuanto el archivo aparece.
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1200,630 \
  --user-data-dir="$TMP" \
  --screenshot="$SALIDA" \
  "http://localhost:$PUERTO/tools/og-template.html" >/dev/null 2>&1 &
CHROME_PID=$!
for _ in $(seq 1 60); do
  [[ -f "$SALIDA" ]] && sleep 1 && break
  sleep 0.5
done
kill $CHROME_PID 2>/dev/null || true
wait $CHROME_PID 2>/dev/null || true
rm -rf "$TMP"

if [[ ! -f "$SALIDA" ]]; then
  echo "No se generó la captura." >&2
  exit 1
fi

echo "og-image.png generado en $SALIDA"
