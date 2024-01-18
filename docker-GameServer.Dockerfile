FROM node:20
WORKDIR /usr/sammich/
CMD ["pwd"]
COPY ./package*.json ./
COPY ./.env ./
RUN npm install  --legacy-peer-deps
CMD ["npx", "prisma", "db", "push"]
CMD ["npx", "prisma", "generate"]
COPY . .
WORKDIR /usr/sammich/server
CMD ["pwd"]
COPY ./server/package*.json ./
RUN npm install --legacy-peer-deps

EXPOSE 2567
CMD ["npm", "run", "prod"]