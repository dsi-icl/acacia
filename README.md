[![Total alerts](https://img.shields.io/lgtm/alerts/g/dsi-icl/itmat-broker.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/dsi-icl/itmat-broker/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/dsi-icl/itmat-broker.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/dsi-icl/itmat-broker/context:javascript)
![Build status](https://github.com/dsi-icl/itmat-broker/workflows/Test%20and%20Build%20CI/badge.svg)

#Develop branch

To deploy the app, some programs need to be installed:

## 0. Prerequisites
### - Mongodb:

Refer [this to install Mongodb](https://docs.mongodb.com/manual/installation/).

A [replica set](https://docs.mongodb.com/manual/replication/) is required to run the app.

You need to [deploy a Mongodb replica set](https://docs.mongodb.com/manual/tutorial/deploy-replica-set/) at your local PC.

Or [convert a standalone to a replica set](https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set/).

### - MinIO:

MinIO is required for high-performance object storage. Refer [this to install MinIO](https://docs.min.io/docs/minio-quickstart-guide.html)


## 1. Install dependencies and build
```bash
yarn install && yarn build
```

## 2. Add your config (and edit them in your editor of choice)
```bash
cp packages/itmat-interface/config/config.sample.json packages/itmat-interface/config/config.json

cp packages/itmat-job-executor/config/config.sample.json packages/itmat-job-executor/config/config.json

cp packages/itmat-setup/config/config.sample.json packages/itmat-setup/config/config.json
```
These config files need to be editted accordingly for Mongodb database (`database{ }`) and MinIO (`objectStore{ }`).

`nodemailer{ }` in `packages/itmat-interface/config.json` is also required to configure for email service.

## 3. Initialise mongodb with seed data
```bash
yarn setupDatabase
```

## 4. Start the app (access it on localhost:3000)
```bash
yarn start
```

