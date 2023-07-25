const { Pool } = require('pg')

class DatabasePool {
  constructor (connectionConfig) {
    this.pool = new Pool(connectionConfig)
  }

  async query (query, values) {
    try {
      const client = await this.pool.connect()
      const result = await client.query(query, values)
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
