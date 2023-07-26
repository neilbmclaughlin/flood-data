const { Pool } = require('pg')
const queries = require('../queries')
const sql = require('sql')
sql.setDialect('postgres')
const slsTelemetryValue = require('../models/sls-telemetry-value.json')

const constructedQueries = {
  slsTelemetryValues: (values) => {
    return sql
      .define({ name: 'sls_telemetry_value', columns: slsTelemetryValue })
      .insert(values)
      .toQuery()
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
    try {
      const client = await this.pool.connect()
      const result = await client.query(query)
      client.release()
      return result
    } catch (error) {
      console.error('Error executing query:', error)
      throw error
    }
  }

  async end () {
    try {
      await this.pool.end()
    } catch (error) {
      console.error('Error ending the pool:', error)
      throw error
    }
  }
}

module.exports = {
  Pool: DatabasePool
}
