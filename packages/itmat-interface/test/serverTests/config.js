const config = {
    "database": {
      "mongo_url": "mongodb://user:password@mongo.dsi.ic.ac.uk:27017/ukbiobank",
      "database": "ukbiobank",
      "collections": {
        "jobs_collection": "JOB_COLLECTION",
        "users_collection": "USER_COLLECTION",
        "studies_collection": "STUDY_COLLECTION",
        "queries_collection": "QUERY_COLLECTION",
        "log_collection": "LOG_COLLECTION"
      }
    },
    "server": {
      "port": 3003
    },
    "bcrypt": {
      "saltround": 2
    },
    "swift": {
      "uri": "http://swift.dsi.ic.ac.uk:8080/auth/v1.0",
      "username": "test:tester",
      "password": "testing"
    }
  }

module.exports = config;