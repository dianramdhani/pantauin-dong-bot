#!/bin/bash

set -e # Stop jika ada error

APP_NAME="jtdc-co" # Ganti dengan nama aplikasimu
OUTPUT_DIR="build" # Output folder

echo "🧹 Cleaning up..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

echo "📦 Downloading dependencies..."
go mod tidy

echo "🔨 Building binary..."
# GOOS=linux GOARCH=amd64 go build -o "$OUTPUT_DIR/$APP_NAME"
GOOS=linux GOARCH=arm GOARM=6 go build -o "$OUTPUT_DIR/$APP_NAME"

echo "✅ Build finished: $OUTPUT_DIR/$APP_NAME"
