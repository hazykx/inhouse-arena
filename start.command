#!/bin/bash
# Spuštění na macOS (dvojklik) a Linuxu (./start.command)
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Chybí Node.js. Nainstaluj verzi LTS z https://nodejs.org a spusť znovu."
  (open "https://nodejs.org" || xdg-open "https://nodejs.org") >/dev/null 2>&1
  read -n 1 -s -r -p "  Stiskni libovolnou klávesu…"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo ""
  echo "  Instaluji balíčky, poprvé to trvá pár minut…"
  npm install || { echo "  Instalace selhala."; exit 1; }
fi

node scripts/setup.mjs || exit 1

echo "  Spouštím web na http://localhost:3000"
echo "  Vypnutí: zavři toto okno nebo stiskni Ctrl+C"
echo ""
( sleep 8; (open "http://localhost:3000" || xdg-open "http://localhost:3000") >/dev/null 2>&1 ) &
npm run dev
