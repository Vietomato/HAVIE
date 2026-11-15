FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm rebuild bcrypt
COPY prisma ./prisma
# Prisma CLI is installed for the release migration job, never copied from host.
RUN npm install --no-save prisma@6.4.0 --ignore-scripts && npx prisma generate
COPY src ./src
COPY data ./data
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "src/server.js"]

FROM base AS loadtest
COPY --chown=node:node scripts ./scripts
ENV NODE_ENV=test
CMD ["node", "scripts/loadtest-sessions.mjs"]

FROM base AS production
