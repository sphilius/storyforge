# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* frontend/.npmrc ./
RUN npm install --ignore-scripts
COPY frontend/ .
RUN npm run build

# Production stage — serve with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback
RUN echo 'server { \
  listen 8080; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri $uri/ /index.html; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
