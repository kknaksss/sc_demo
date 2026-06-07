# frontend — Next.js App Router (SC-SPEC-05 §3, SC-WP-01 C3).
# 버전 핀/이미지 tag 는 코드 SoT — node:20-slim 기준. standalone 멀티스테이지.

# 1) deps — lockfile 기준 의존성 설치 (소스 변경과 분리해 캐시).
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) builder — 앱 빌드 (standalone 산출).
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 3) runner — 최소 런타임만 복사.
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# standalone server.js 가 PORT(3000) 로 listen — compose 가 33000:3000 매핑.
CMD ["node", "server.js"]
