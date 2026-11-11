#!/bin/bash
cd "$(dirname "$0")"
[ -d node_modules ] || { echo "  Nejdřív spusť start.command"; exit 1; }
npm run db:seed
echo ""
echo "  Hotovo. Obnov stránku v prohlížeči."
read -n 1 -s -r -p "  Stiskni libovolnou klávesu…"
