# Multi-stage build — Vue3/TS PWA (vite-plugin-pwa) served by nginx.
#
# Build-time VITE_* args are inlined into the JS bundle by Vite, so they must
# be passed as --build-arg at `docker build` time (see deploy/docker-compose.yml).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_ENV=production
ARG VITE_APP_NAME=Ferrum
ARG VITE_RXDB_SYNC_DAYS
ARG VITE_RXDB_PULL_INTERVAL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_APP_ENV=$VITE_APP_ENV \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_RXDB_SYNC_DAYS=$VITE_RXDB_SYNC_DAYS \
    VITE_RXDB_PULL_INTERVAL=$VITE_RXDB_PULL_INTERVAL

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
