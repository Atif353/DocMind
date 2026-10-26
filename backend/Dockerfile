FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S docmind && adduser -S docmind -G docmind
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
RUN mkdir -p /data/uploads && chown -R docmind:docmind /app /data/uploads
USER docmind
EXPOSE 5000
CMD ["node", "src/server.js"]

