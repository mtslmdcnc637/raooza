FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY index.js ./

ENV MSG_PORT=8789
ENV NODE_ENV=production

EXPOSE 8789

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O- http://localhost:8789/health || exit 1

CMD ["node", "index.js"]
