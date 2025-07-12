FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the app
COPY . .

# Build the app
RUN pnpm build

# Tell Node.js to use production mode
ENV NODE_ENV=production

# Default command
CMD ["node", "dist/index.js"]
