# builder
FROM node:18-alpine AS builder

WORKDIR /frontend

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build



# serveur de prod
FROM nginx:alpine

WORKDIR /usr/share/nginx/html

COPY --from=builder /frontend/dist /usr/share/nginx/html

EXPOSE 80