FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

EXPOSE 3002

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
