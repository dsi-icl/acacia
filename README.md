#Develop branch

To deploy the app, some programs need to be installed:

0. Prerequisites
- Mongodb:

Refer [this to install Mongodb] (https://docs.mongodb.com/manual/installation/).

A [replica set] is required to run the app (https://docs.mongodb.com/manual/replication/).

You need to [deploy a Mongodb replica set] at your local PC (https://docs.mongodb.com/manual/tutorial/deploy-replica-set/)

Or [convert a standalone to a replica set] (https://docs.mongodb.com/manual/tutorial/convert-standalone-to-replica-set/).

- MinIO:

MinIO is required for high-performance object storage. Refer [this to install MinIO] (https://docs.min.io/docs/minio-quickstart-guide.html)

To start the app, run the following commands at root folder (you will have to have `yarn` installed):

1. Install dependencies and build
```bash
yarn install && yarn build
```

2. Add your config (and edit them in your editor of choice)
```bash
cp packages/itmat-interface/config.sample.json packages/itmat-interface/config.json

cp packages/itmat-job-executor/config.sample.json packages/itmat-job-executor/config.json
```
These config files need to be editted accordingly for Mongodb database (```database{ }```) and MinIO (```objectStore{ }```).

```nodemailer{ }``` in ```packages/itmat-interface/config.json``` is also required to configure for email service.

3. Start the app (access it on localhost:3000)
```bash
yarn start
```

