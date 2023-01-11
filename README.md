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

Both software also have easy to start docker images available for convenience.

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

### Add configuration

You will need to provide database and object store connection details and will have the ability to customised other paramters. We typically recommend that you configure your secrets.

```bash
cp packages/itmat-interface/config/config.sample.json packages/itmat-interface/config/config.json
cp packages/itmat-job-executor/config/config.sample.json packages/itmat-job-executor/config/config.json
```
These config files need to be editted accordingly for Mongodb database (`database{ }`) and MinIO (`objectStore{ }`).

`nodemailer{ }` in `packages/itmat-interface/config/config.json` is also required to configure for email service.

### Initialise mongodb with seed data

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
