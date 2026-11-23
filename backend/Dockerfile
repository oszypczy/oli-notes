FROM node:24.22.3-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24.22.3-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
# npm is not needed at runtime; removing it drops its bundled (often vulnerable) deps
RUN npm ci --omit=dev && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    && apk upgrade --no-cache
USER app
EXPOSE 3000
CMD ["node", "dist/index.js"]
