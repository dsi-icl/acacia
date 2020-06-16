#Develop branch

To deploy the app, some programs need to be installed:

0. Prerequisites
- Mongodb
Refer this website to [install Mongodb] (https://docs.mongodb.com/manual/installation/)
A [replica set] is required to run the app (https://docs.mongodb.com/manual/replication/).
You need to [deploy a Mongodb replica set] at your local PC (https://docs.mongodb.com/manual/tutorial/deploy-replica-set/)

- MinIO



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

3. Start the app (access it on localhost:3000)
```bash
yarn start
```

