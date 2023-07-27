const { Pool } = require('pg')
const queries = require('../queries')
// Note: using knex as a query builder only here in order to minimise change
// if we were going to replace pg with knex then the queries above would need to have their
// positional parameter changed from, say, $1 to ?
const knex = require('knex')({ client: 'pg' })
const VError = require('verror')

const constructedQueries = {

  slsTelemetryValues: (values) => {
    return knex('sls_telemetry_value').insert(values).toQuery()
  }
}

class DatabasePool {
  constructor (connectionConfig) {
    this.pool = new Pool(connectionConfig)
  }

  async query (queryName, values) {
    const query = (queries[queryName])
      ? { text: queries[queryName], values }
      : constructedQueries[queryName](values)
    const client = await this.pool.connect()
    try {
      return await client.query(query)
    } catch (error) {
      console.error('Error querying DB')
      throw new VError(error, 'Error querying DB')
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
