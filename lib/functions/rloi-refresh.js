const station = require('../models/station')
const rloi = require('../models/rloi')
const { Pool } = require('../helpers/pool')

module.exports.handler = async () => {
  const pool = new Pool({ connectionString: process.env.LFW_DATA_DB_CONNECTION })
  await rloi.deleteOld(pool)
  await station.refreshStationMview(pool)
  await pool.end()
}
