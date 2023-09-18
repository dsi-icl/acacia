[![Total alerts](https://img.shields.io/lgtm/alerts/g/ideafast/ideafast-portal.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/ideafast/ideafast-portal/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/ideafast/ideafast-portal.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/ideafast/ideafast-portal/context:javascript)
[![Mutation testing badge](https://img.shields.io/endpoint?style=flat&url=https%3A%2F%2Fbadge-api.stryker-mutator.io%2Fgithub.com%2Fideafast%2Fideafast-portal%2Fmaster)](https://dashboard.stryker-mutator.io/reports/github.com/ideafast/ideafast-portal/master)
![Build status](https://github.com/ideafast/ideafast-portal/workflows/Test%20and%20Build%20CI/badge.svg)
[![Dependency Status](https://img.shields.io/david/ideafast/ideafast-portal.svg)](https://david-dm.org/ideafast/ideafast-portal)
[![devDependency Status](https://img.shields.io/david/dev/ideafast/ideafast-portal.svg)](https://david-dm.org/ideafast/ideafast-portal?type=dev)

![IDEAFast ID Generator](https://avatars3.githubusercontent.com/u/60649739?s=100&v=4)

# The IDEAFast Feasibility Portal

## Usage

The project is meant to be used as part of a Docker/Kubernetes container deployment. At present these container are not yet published and we invite you to look at the developer setup below.

## Local development

### Requirements

First things first, there's always something before you can start.

To make our life easier, we use [Yarn](https://yarnpkg.com/) a lot. Make sure you have it installed.

This software requires both MongoDB and MinIO to be available. Follow the installation guidelines for these software directly from their respective websites:

- [https://docs.mongodb.com](https://docs.mongodb.com/manual/installation/)
- [https://docs.min.io](https://docs.min.io/docs/minio-quickstart-guide.html)

### Install dependencies and build the project

Building the library is easy. First run `yarn install && yarn build`, to build the application. The current application is built ontop of a system called ICL-ITMAT-Broker comprised of multiple components including :

- itmat-commons
- itmat-docker
- itmat-interface
- itmat-job-executor
- itmat-models
- itmat-setup
- itmat-types
- itmat-ui-react
- itmat-ui-react-e2e

### Requirements bootstrap (quick treatment)

Using Docker to quickly setup a development environment for the DMP is easy.

*Note: The IP addresses, ranges, paths and container names used below serve as examples only, those should be adjusted to match you environment settings and requirements.*

First create an environment file for the MinIO server:

```
$> cat /opt/dmp/env/minio
MINIO_ACCESS_KEY=jdu3Dr4Wjd4E
MINIO_SECRET_KEY=9Deu2ER25Fvc
```

You will need to create a Docker network (see <https://docs.docker.com/network/>) on which a MongoDB and a MinIO instance are present:

`docker network create --attachable --subnet=10.34.0.0/24 dmp`

Run the MinIO server (optionally mount a container volume for the data to be saved externally):

`docker run -d --net=dmp --ip=10.34.0.10 --restart always --env-file /opt/dmp/env/minio -v /data/minio:/data -p 9000:9000 --name minio quay.io/minio/minio server /data`

Run the MongoDB server (insure to prepare optionally mount a container volume for the data to be saved externally):

`docker run -d --net=dmp --ip=10.34.0.11 --restart always -v /data/mongo:/data/db -p 27017:27017 --name mongodb mongo --replSet rs0`

You will need to initialize the replica set manually for this to function. You can do so my connecting to the MongoDB container and issue the following command:

```
$> docker exec -it mongodb mongosh
Connecting to:          mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+1.6.0
Using MongoDB:          6.0.2
Using Mongosh:          1.6.0

For mongosh info see: https://docs.mongodb.com/mongodb-shell/

rs0 test> use admin
rs0 admin> rs.initiate()
rs0 [direct: primary] admin> rs.status().ok
1
```

Depending on your DNS configuration you may need to add the container hostname map to IP (MongoDB listening)  to your `/etc/hosts` file.
`127.0.0.1  [hostname of MongoDB container]`
(If your dmp service is running on the host machine, you need to add this line to the hosts file on your host machine, because the MongoDB client in the host machine will try to connect to the MongoDB server by its hostname of the container)

You can figure the hostname out using the following command

`docker exec -it mongodb hostname`

Finally you will need configure to setup the configuration of the various pacakges for development (see below).

### Configuration

You will need to provide database and object store connection details and will have the ability to customised other paramters. We typically recommend that you configure your secrets.

```
cp packages/itmat-interface/config/config.sample.json packages/itmat-interface/config/config.json
cp packages/itmat-job-executor/config/config.sample.json packages/itmat-job-executor/config/config.json
```

These config files need to be editted accordingly for Mongodb database (`database{ }`) and MinIO (`objectStore{ }`).

`nodemailer{ }` in `packages/itmat-interface/config/config.json` is also required to configure for email service.

### Database setup

You will need to setup the database and its collections if your database is empty.

Copy your configuration file you setup in last step to root directory. Only database configuration is required.

```bash
cp packages/itmat-interface/config/config.json ./
```

Then run the following command to setup the database. This will create the database and its collections with indexes for you.

```bash
yarn setupDatabase
```

### Start developing

Once all that is done, you only need to use `yarn dev` to start the software in development mode.

## Credits

Big shout out goes to all the members of the Data Science Institute team at Imperial College London with special thanks to [@sou-chon](https://github.com/sou-chon) for laying the ground work this portal it built on.

## Contributing

Pull requests are welcome!
See the [list of open issues](https://github.com/ideafast/ideafast-portal/issues) to get an idea of what you could work on.
Or, if you have an awesome idea, please [create a new issue](https://github.com/ideafast/ideafast-portal/issues/new).
