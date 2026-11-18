FROM node:20-alpine AS build_stage
WORKDIR /application
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build_stage /application/dist /usr/share/nginx/html
EXPOSE 80
