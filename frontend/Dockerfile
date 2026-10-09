FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public config is compiled into the bundle, so the API address is a build argument.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
