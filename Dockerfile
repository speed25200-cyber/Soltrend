# Soltrend realtime API (NestJS + Socket.IO) — the hosted server that powers
# multiplayer Crash rooms. Static hosts (GitHub Pages) can't run this; deploy it
# to any Node host and point NEXT_PUBLIC_REALTIME_URL at it.
FROM node:20-slim

WORKDIR /app

# Install workspace deps (root lockfile needs every workspace manifest present).
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN npm install --omit=optional --no-audit --no-fund

# Only the API + its shared dep are needed at runtime (ts-node runs the source).
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["npm", "run", "start", "--workspace", "@soltrend/api"]
