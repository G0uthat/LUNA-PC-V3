#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Instalando dependencias de Luma Desktop..."
npm install

if [[ "$(uname)" == "Darwin" ]]; then
  echo "Compilando instalador macOS (.dmg)..."
  npm run dist:mac
else
  echo "Compilando ejecutable Linux (.AppImage y .deb)..."
  npm run dist:linux
fi

echo "Ejecutable generado en: $(pwd)/release"
