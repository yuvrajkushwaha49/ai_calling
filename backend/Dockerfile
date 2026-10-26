# Multi-stage production build for NestJS backend
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma Client for MySQL
RUN npx prisma generate

# Copy source and build
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src/

RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Copy dependencies and build output
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production && npm cache clean --force

# Re-generate Prisma Client inside runner image
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

# Create uploads directory for persistent storage of PDFs/audio
RUN mkdir -p /app/uploads/knowledge && chown -R node:node /app/uploads

USER node

EXPOSE 4000

CMD ["node", "dist/main"]
