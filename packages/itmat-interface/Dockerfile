FROM node:10

MAINTAINER Chon Sou (c.sou16@imperial.ac.uk)

WORKDIR /itmat-API

COPY ./package*.json ./

RUN npm install --production

RUN mkdir -p dist/config

COPY dist/src dist/src

EXPOSE 80

CMD ["node", "./dist/src/index.js"]