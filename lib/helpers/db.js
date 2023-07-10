const pg = require('knex')({
  client: 'pg',
  // debug: true,
  connection: process.env.LFW_DATA_DB_CONNECTION,
  pool: { min: 0, max: 10 }
})

module.exports = pg
