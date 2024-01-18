
FROM node:20
CMD ["pwd"]
WORKDIR /usr/tournamnet-web
COPY . .
WORKDIR /usr/tournamnet-web/client
COPY client/package*.json ./
RUN npm install
CMD ["npm", "run", "build"]
WORKDIR /usr/tournamnet-web/api
COPY api/package*.json ./
RUN npm install
COPY . .
CMD ["npx", "prisma", "db", "push"]
CMD ["npx", "prisma", "generate"]
CMD ["npm", "run", "dev"]

EXPOSE 3000