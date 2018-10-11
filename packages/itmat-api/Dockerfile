FROM node:10-alpine

MAINTAINER Chon Sou (c.sou16@imperial.ac.uk)

WORKDIR /itmat-API

COPY ./package*.json ./

RUN npm install --production

COPY dist dist

EXPOSE 3010

CMD ["npm start"];
