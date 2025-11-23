FROM node:18-alpine

# Install PM2 globally
RUN npm install -g pm2

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose ports
EXPOSE 4000
EXPOSE 5001

# Start processes using PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
