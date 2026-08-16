FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS development

COPY . ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM base AS build

ARG VITE_USE_MOCK_API=true
ARG VITE_API_ORIGIN=
ENV VITE_USE_MOCK_API=$VITE_USE_MOCK_API
ENV VITE_API_ORIGIN=$VITE_API_ORIGIN

COPY . ./
RUN npm run build

FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
