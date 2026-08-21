# syntax=docker/dockerfile:1

# ---- 构建阶段 ----
FROM node:22-slim AS build

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=$NPM_REGISTRY

WORKDIR /app

RUN npm install -g pnpm@10.24.0

# 先复制依赖清单以利用缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/server/package.json ./apps/server/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

# 复制全部源码
COPY apps ./apps

RUN pnpm --filter @handyin/server prisma:generate

# 前端 base path 由构建参数注入
ARG HANDYIN_BASE_PATH=/handyin
ENV HANDYIN_BASE_PATH=$HANDYIN_BASE_PATH
RUN pnpm --filter @handyin/web build

RUN pnpm --filter @handyin/server build

# ---- 运行阶段 ----
FROM node:22-slim AS run

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app /app

ENV WEB_DIST=/app/apps/web/dist
ENV HOST=0.0.0.0
ENV APP_PORT=3000

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]
