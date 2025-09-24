FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

###################
# BUILD FOR PRODUCTION
###################

FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY --chown=node:node --from=development /usr/src/app/node_modules ./node_modules

COPY --chown=node:node package*.json ./

COPY --chown=node:node tsconfig.json ./

COPY --chown=node:node src ./src

# Install TypeScript globally for building
RUN npm install -g typescript

# Build the TypeScript code
RUN npm run build

# Install curl for health checks
RUN apk add --no-cache curl

USER node

# Expose port for HTTP mode
EXPOSE 3000

# Health check for HTTP mode
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD [ "node", "dist/index.js" ]
