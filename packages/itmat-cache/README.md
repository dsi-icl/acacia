# itmat-cache
[![Croissants](https://img.shields.io/badge/made-with_Croissants-4da3ff.svg?style=flat-square)](http://www.imperial.ac.uk/itmat-data-science-group/)


ITMAT - Cache micro-service
---------------------------

The itmat-cache service provides caching capabilities to the ITMAT eco-system. The itmat-cache stores which queries 
have been executed in the past, and when identical queries are submitted to the system in the future, it 
automatically returns the answer, without triggering any query to MongoDB. To do so, the itmat-cache communicates with the
itmat-client every time a query is submitted to the ITMAT system.

## Configuration
At its construction, the `itmatCache` server receives a configuration object that MUST respect the following schema:
 * [Example configuration](config/itmat.cache.sample.config.js)
 * [Tests configuration](config/itmat.cache.test.config.js)
 


### Contributing
TODO