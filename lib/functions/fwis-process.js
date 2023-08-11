const { Pool } = require('../helpers/pool')
const fwis = require('../models/fwis')
const wreck = require('../helpers/wreck')

module.exports.handler = async (event) => {
  // Get Warnings from the FWIS api
  const { warnings } = await wreck.request('get', process.env.LFW_DATA_FWIS_API_URL, {
    json: true,
    headers: {
      'x-api-key': process.env.LFW_DATA_FWIS_API_KEY
    },
    timeout: 30000
  }, true)
  // Get the current seconds since epoch
  const timestamp = Math.round((new Date()).getTime() / 1000)

  const pool = new Pool({ connectionString: process.env.LFW_DATA_DB_CONNECTION })
  await fwis.save(warnings, timestamp, pool)
  await pool.end()
}
