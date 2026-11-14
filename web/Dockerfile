FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build
EXPOSE 3000
# Команда запуска задаётся в docker-compose.yml (веб и бот используют один образ)
CMD ["npm", "start"]
