FROM node:20-alpine
WORKDIR /application

# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

# docker-compose overrides this to run "prisma db push" first.
CMD ["node", "dist/server.js"]
