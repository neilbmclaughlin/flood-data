const { Pool } = require('pg')
const VError = require('verror')
const constructedQueries = require('../constructed-queries')

class DatabasePool {
  constructor (connectionConfig) {
    this.pool = new Pool(connectionConfig)
  }

  async query (queryString, values) {
    /*
    * TODO: once all lambdas are migrated to use constructed queries,
    *  the Pool class should no longer support arbitrary queries
    */
    let query = {
      text: queryString,
      values
    }
    if (constructedQueries[queryString]) {
      query = constructedQueries[queryString](values)
    }
    const client = await this.pool.connect()
    try {
      return await client.query(query)
    } catch (error) {
      throw new VError(error, 'Error querying DB (query: %s)', query.toString())
    } finally {
      if (client) {
        await client.release()
      }
    }
  }

  async end () {
    try {
      await this.pool.end()
    } catch (error) {
      console.error('Error ending the pool:', error)
      throw new VError(error, 'Error ending pool')
    }
  }
}

module.exports = {
  Pool: DatabasePool
}
