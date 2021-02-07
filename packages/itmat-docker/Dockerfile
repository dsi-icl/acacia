FROM node:lts-alpine

LABEL author="Florian Guitton" email="f.guitton@imperial.ac.uk"

RUN mkdir -p /itmat-base

WORKDIR /itmat-base

COPY ./itmat-docker/package.json .
COPY ./itmat-docker/.npmrc .

RUN npm install --production
RUN mkdir ./config

COPY ./itmat-docker/launcher.js ./
COPY ./itmat-interface/build/* ./
COPY ./itmat-job-executor/build/* ./
COPY ./itmat-ui-react/build/* ./static/

EXPOSE 3080
CMD [ "node", "launcher.js" ]