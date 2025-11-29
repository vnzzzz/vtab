#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

rm -rf dist
mkdir dist

# src の中身を dist にコピー
cp -R src/* dist/

# zip 作成（dist の中身をルートにした zip にする）
cd dist
zip -r ../vtab.zip .
