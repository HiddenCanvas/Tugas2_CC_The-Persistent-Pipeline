# Multi-Container Web Architecture - Misi 2: The Persistent Pipeline
# Base image lightweight Node.js 20 Alpine
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install application dependencies
RUN npm install --production

# Copy application source code
COPY app.js ./

# Expose server port
EXPOSE 3000

# Start Express server
CMD ["node", "app.js"]

