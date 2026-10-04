FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and worker manifests
COPY package.json package-lock.json ./
COPY services/execution-worker/package.json ./services/execution-worker/

# Install root dependencies
RUN npm ci

# Install worker dependencies
WORKDIR /app/services/execution-worker
RUN npm install

# Copy entire repo to resolve shared packages and contracts
WORKDIR /app
COPY . .

# Build self-contained execution-worker bundle
WORKDIR /app/services/execution-worker
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/execution-worker/dist /app/dist
COPY --from=builder /app/services/execution-worker/node_modules /app/node_modules
COPY --from=builder /app/services/execution-worker/package.json /app/package.json

ENV NODE_ENV=production
EXPOSE 4310

CMD ["node", "dist/index.js"]
