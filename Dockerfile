# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of the application code
COPY . .

# Make sure public/ exists if you're serving static files
RUN mkdir -p public

# Expose port
EXPOSE 3000

# Start the server
CMD [ "npm", "start" ]
