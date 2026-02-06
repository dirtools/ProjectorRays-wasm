#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_PATH="$ROOT_DIR/package.json"
BACKUP_PATH="$ROOT_DIR/.package.json.publish.bak"

if [[ -f "$BACKUP_PATH" ]]; then
  echo "Backup already exists at $BACKUP_PATH. Aborting."
  exit 1
fi

cleanup() {
  if [[ -f "$BACKUP_PATH" ]]; then
    mv "$BACKUP_PATH" "$PKG_PATH"
  fi
}

trap cleanup EXIT

cp "$PKG_PATH" "$BACKUP_PATH"

node -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const pkgPath = path.resolve(process.cwd(), "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  delete pkg.scripts;
  delete pkg.devDependencies;
  delete pkg.packageManager;

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
' "$ROOT_DIR"

if [[ $# -eq 0 ]]; then
  npm publish
else
  echo ".. $*"
  "$@"
fi

VERSION="$(PKG_PATH="$PKG_PATH" node -e 'console.log(require(process.env.PKG_PATH).version)')"
TAG="v$VERSION"
git -C "$ROOT_DIR" tag "$TAG"
git -C "$ROOT_DIR" push origin "$TAG"

echo "Donee!"
