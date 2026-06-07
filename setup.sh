#!/bin/bash
# sc_demo setup — worker(open-kknaks)용 Linux node + Claude Code(JS) 를 .claude-tools/ 에 스테이징.
# claude 를 컨테이너 이미지에 설치하지 않고, 여기서 만든 .claude-tools 를 compose 가 :ro 마운트.
# JS(claude) 는 플랫폼무관 + node 는 Linux판 → Mac/Linux host 양쪽에서 컨테이너가 동작.
# 참조: open-kknaks examples/setup.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOOLS_DIR="${SCRIPT_DIR}/.claude-tools"
NODE_VERSION="22.16.0"

# Docker 플랫폼 아키텍처 (Mac arm64 → linux/arm64)
case "$(uname -m)" in
  x86_64)        NODE_ARCH="x64" ;;
  aarch64|arm64) NODE_ARCH="arm64" ;;
  *) echo "ERROR: 지원하지 않는 아키텍처: $(uname -m)"; exit 1 ;;
esac

NODE_DIR="${TOOLS_DIR}/node"
TARBALL="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"

echo "=== Linux Node ${NODE_VERSION} (${NODE_ARCH}) → .claude-tools/node ==="
if [ ! -x "${NODE_DIR}/bin/node" ]; then
  mkdir -p "${NODE_DIR}"
  curl -fSL "https://nodejs.org/dist/v${NODE_VERSION}/${TARBALL}" -o "${TOOLS_DIR}/${TARBALL}"
  tar -xJf "${TOOLS_DIR}/${TARBALL}" -C "${NODE_DIR}" --strip-components=1
  rm -f "${TOOLS_DIR}/${TARBALL}"
else
  echo "이미 설치됨 — 건너뜀"
fi

echo "=== Claude Code CLI (JS, 플랫폼무관) → .claude-tools/node_modules ==="
command -v npm >/dev/null || { echo "ERROR: host 에 npm 필요 (https://nodejs.org)"; exit 1; }
npm install --prefix "${TOOLS_DIR}" @anthropic-ai/claude-code

echo ""
echo "=== 완료 ==="
echo "  .claude-tools/node/         — Linux Node (컨테이너용)"
echo "  .claude-tools/node_modules/ — Claude Code CLI (JS)"
echo ""
echo "다음: .env 에 CLAUDE_CODE_OAUTH_TOKEN 설정 후 (host: 'claude setup-token')"
echo "      docker compose up -d --build"
