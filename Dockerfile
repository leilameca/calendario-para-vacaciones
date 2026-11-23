FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.mjs ./
COPY lib ./lib
COPY public ./public
COPY scripts/recover-admin.mjs ./scripts/recover-admin.mjs
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100 DATA_DIR=/data COOKIE_SECURE=true
USER node
EXPOSE 3100
VOLUME /data
CMD ["node", "server.mjs"]
