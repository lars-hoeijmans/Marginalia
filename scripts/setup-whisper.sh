#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="/tmp/whisper-build"
OUT_DIR="$PROJECT_DIR/resources/bin"

echo "==> Cleaning previous build..."
rm -rf "$BUILD_DIR"

echo "==> Cloning whisper.cpp..."
git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git "$BUILD_DIR"

echo "==> Building whisper-cli for arm64 with Metal..."
cd "$BUILD_DIR"
cmake -B build -DCMAKE_OSX_ARCHITECTURES=arm64 -DBUILD_SHARED_LIBS=OFF
cmake --build build -j --config Release

echo "==> Copying whisper-cli to $OUT_DIR..."
mkdir -p "$OUT_DIR"
cp build/bin/whisper-cli "$OUT_DIR/whisper-cli"

echo "==> Cleaning up build directory..."
rm -rf "$BUILD_DIR"

echo "==> Done! whisper-cli is at $OUT_DIR/whisper-cli"
