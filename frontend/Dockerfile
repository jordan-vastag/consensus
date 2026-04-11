FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN yarn install

COPY . .

# NEXT_PUBLIC_* vars are baked into the Next.js bundle at build time.
# Empty string = same-origin relative URLs (production behind nginx).
ARG NEXT_PUBLIC_API_ORIGIN
ENV NEXT_PUBLIC_API_ORIGIN=${NEXT_PUBLIC_API_ORIGIN}

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
RUN yarn install --production

EXPOSE 3000
CMD ["npm", "run", "start"]
