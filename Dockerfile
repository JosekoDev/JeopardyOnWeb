# Stage 1: Build the React client
FROM node:20-alpine AS builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Stage 2: Build the Server
FROM node:20-alpine

WORKDIR /app
COPY server/package*.json ./server/
RUN cd server && npm ci --production

COPY server/ ./server/
# Copy built client to server public directory
COPY --from=builder /app/client/dist ./server/public/

WORKDIR /app/server
EXPOSE 3010
ENV NODE_ENV=production
ENV PORT=3010

CMD ["node", "src/index.js"]
