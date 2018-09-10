# itmat-broker-api

RESTful API for the itmat-broker project.

---------------------------

The itmat-broker-api service provides a RESTful API for the itmat-broker project. The API is documented using a [Swagger](https://swagger.io/) 2.0 specification.


## Configuration
In order to run **itmat-broker-api**, you must define the environment variable *ITMAT_CONFIG* as the path to your config file. An example of a valid config file can be found [here](https://github.com/dsi-icl/itmat-broker-core/blob/master/config.json). Once this requirement has been met, the application can be launched as:

```
npm start
```

## How to test
In order to test this package, you must define the environment variable *ITMAT_TEST_CONFIG* as the path to your test config file. An example of a valid test config file can be found [here](https://github.com/dsi-icl/itmat-broker-core/blob/master/test.config.json). Given the test config file, the tests can be launched as:

```
npm test
```
