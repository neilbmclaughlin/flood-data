const logger = require('../helpers/logging')
const pg = require('../helpers/db')
const invokeLambda = require('../helpers/invoke-lambda')
const { deleteStation, getRloiIds, getStationData, validateStationData } = require('../helpers/imtd-api')

async function insertStation (stationDataArray) {
  try {
    await pg.transaction(async trx => {
      await Promise.all(stationDataArray.map(async (stationData) => {
        const stationID = stationData.station_id
        await trx('station_display_time_series').where({ station_id: stationID }).delete()
        await trx('station_display_time_series').insert(stationData)
        logger.info(`Processed displayTimeSeries for RLOI id ${stationID}`)
      }))
    })
  } catch (error) {
    logger.error('Database error processing stationData', error)
    throw error
  }
}

async function getData (stationId) {
  try {
    const stationData = await getStationData(stationId)
    if (stationData.length === 0) {
      (console.log('Deleting station: ', stationId))
      const tableName = 'station_display_time_series'
      await deleteStation(stationId, tableName)
    }
    await validateStationData(stationData)
    await insertStation(stationData)
  } catch (error) {
    logger.error(`Could not process data for station ${stationId} (${error.message})`)
  }
}

async function handler ({ offset = 0 } = {}) {
  const BATCH_SIZE = parseInt(process.env.IMTD_BATCH_SIZE || '500')

  logger.info(`Retrieving up to ${BATCH_SIZE} rloi_ids with an offset of ${offset}`)
  const rloiids = await getRloiIds({
    offset,
    limit: BATCH_SIZE
  })
  logger.info(`Retrieved ${rloiids.length} rloi_ids`)

  for (const rloiid of rloiids) {
    await getData(rloiid.rloi_id)
  }

  if (rloiids.length >= BATCH_SIZE) {
    const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME
    const newOffset = offset + BATCH_SIZE
    logger.info(`Invoking ${functionName} with an offset of ${newOffset}`)

    await invokeLambda(functionName, {
      offset: newOffset
    })
  }
}

module.exports = {
  handler,
  validateStationData
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, destroying DB connection')
  await pg.destroy()
  process.exit(0)
})
