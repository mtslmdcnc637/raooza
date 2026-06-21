FROM node:20-alpine

WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY index.js ./

# Env
ENV PORT=8787
ENV NODE_ENV=production

EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O- http://localhost:8787/health || exit 1

CMD ["node", "index.js"]
