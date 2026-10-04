FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and gateway manifests
COPY package.json package-lock.json ./
COPY services/laixi-gateway/package.json ./services/laixi-gateway/

# Install root dependencies
RUN npm ci

# Install gateway dependencies
WORKDIR /app/services/laixi-gateway
RUN npm install

# Copy entire repo to resolve shared packages and contracts
WORKDIR /app
COPY . .

# Build self-contained laixi-gateway bundle
WORKDIR /app/services/laixi-gateway
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/services/laixi-gateway/dist /app/dist
COPY --from=builder /app/services/laixi-gateway/node_modules /app/node_modules
COPY --from=builder /app/services/laixi-gateway/package.json /app/package.json

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "dist/index.js"]
