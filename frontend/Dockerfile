# Stage 1 — build the React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# VITE_ vars are baked into the JS bundle at build time
ARG VITE_BACKEND_URL=http://localhost:8000
ARG VITE_ELEVENLABS_API_KEY
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_ELEVENLABS_API_KEY=$VITE_ELEVENLABS_API_KEY

RUN npm run build

# Stage 2 — serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
