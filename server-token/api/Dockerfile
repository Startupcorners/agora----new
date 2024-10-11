# Use the official Node.js image.
FROM node:16

# Create and set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json into the container
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application code into the container
COPY . .

# Copy the .env file into the container
COPY .env .env

# Expose the application's port
EXPOSE 8080

# Start the server
CMD ["node", "index.js"]
