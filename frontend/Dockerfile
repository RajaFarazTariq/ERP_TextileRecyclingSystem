# ── Build the React app ─────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Same-origin API: nginx below forwards /api/ to the backend
ARG REACT_APP_API_URL=/api/
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN CI=false npm run build

# ── Serve it with nginx ─────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
