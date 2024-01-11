
FROM node:20
CMD ["pwd"]
WORKDIR /usr/tournamnet-web

COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start"]