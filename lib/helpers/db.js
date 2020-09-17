const { Pool } = require('pg')

let pool

class Db {
  constructor (test) {
    this.init(test)
  }

  init (test) {
    if (!test && (!pool || pool.ending)) {
      pool = new Pool({
        connectionString: process.env.LFW_DATA_DB_CONNECTION
      })
    }
  }

  query (query, vars) {
    this.init()
    return pool.query(query, vars)
  }

  // introduced this method to make assertion using mocking possible since it is not possible to
  // use multiple different withArgs for a single method (i.e. it is not possible to mock calls to
  // both query(query) and query(query, vars) in a single test).
  // As the code gets refactored so the save method is decomposed into smaller testable units
  // then the need to do this should disappear
  query1 (query) {
    this.query(query)
  }

  async end () {
    return new Promise((resolve) => {
      if (pool && !pool.ending) {
        pool.end(() => {
          console.log('pool ended')
          return resolve()
        })
      } else {
        return resolve()
      }
    })
  }
}

module.exports = Db
