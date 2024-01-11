
FROM node:20
CMD ["pwd"]
WORKDIR /usr/ws-server

COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 2567
CMD ["npm", "run", "start"]