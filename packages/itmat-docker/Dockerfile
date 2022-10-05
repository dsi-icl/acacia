FROM node:lts-alpine

LABEL author="Florian Guitton" email="f.guitton@imperial.ac.uk"

RUN mkdir -p /itmat-base

WORKDIR /itmat-base

COPY ./packages/itmat-docker/package.json ./
COPY ./packages/itmat-docker/.npmrc ./

RUN npm install --production --legacy-peer-deps
RUN mkdir ./config

COPY ./packages/itmat-docker/launcher.js ./
COPY ./dist/packages/itmat-interface/interface* ./
COPY ./dist/packages/itmat-job-executor/executor* ./
COPY ./dist/packages/itmat-ui-react/* ./

EXPOSE 3080
CMD [ "node", "launcher.js" ]