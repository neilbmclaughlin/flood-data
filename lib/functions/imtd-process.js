const parseThresholds = require('../models/parse-thresholds')
const logger = require('../helpers/logging')
const pg = require('../helpers/db')
const invokeLambda = require('../helpers/invoke-lambda')
const deleteThresholds = require('../helpers/imtd-api').deleteStation
const { getRloiIds, getImtdApiResponse } = require('../helpers/imtd-api')
const tableName = 'station_imtd_threshold'

async function insertThresholds (stationId, thresholds) {
  try {
    const mappedThresholds = thresholds.map(t => {
      return {
        station_id: stationId,
        fwis_code: t.floodWarningArea,
        fwis_type: t.floodWarningType,
        direction: t.direction,
        value: t.level,
        threshold_type: t.thresholdType
      }
    })
    await pg.transaction(async trx => {
      await trx('station_imtd_threshold').where({ station_id: stationId }).delete()
      await trx('station_imtd_threshold').insert(mappedThresholds)
      logger.info(`Processed ${mappedThresholds.length} thresholds for RLOI id ${stationId}`)
    })
  } catch (error) {
    logger.error(`Database error processing thresholds for station ${stationId}`, error)
    throw error
  }
}

async function getIMTDThresholds (stationId) {
  const response = await getImtdApiResponse(stationId)
  if (response.data) {
    return parseThresholds(response.data[0].TimeSeriesMetaData)
  }
  return []
}

async function getData (stationId) {
  try {
    const thresholds = await getIMTDThresholds(stationId)
    if (thresholds.length > 0) {
      await insertThresholds(stationId, thresholds)
    } else {
      await deleteThresholds(stationId, tableName)
      logger.info(`Deleted data for RLOI id ${stationId}`)
    }
  } catch (error) {
    logger.error(`Could not process data for station ${stationId} (${error.message})`)
  }
}

async function handler ({ offset = 0 } = {}) {
  const BATCH_SIZE = parseInt(process.env.IMTD_BATCH_SIZE || '500')

  logger.info(`Retrieving up to ${BATCH_SIZE} rloi_ids with an offset of ${offset}`)
  const stations = await getRloiIds({
    offset,
    limit: BATCH_SIZE
  })
  logger.info(`Retrieved ${stations.length} rloi_ids`)

  for (const station of stations) {
    await getData(station.rloi_id)
  }

  if (stations.length >= BATCH_SIZE) {
    const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME
    const newOffset = offset + BATCH_SIZE
    logger.info(`Invoking ${functionName} with an offset of ${newOffset}`)

    await invokeLambda(functionName, {
      offset: newOffset
    })
  }
}

module.exports.handler = handler

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, destroying DB connection')
  await pg.destroy()
  process.exit(0)
})
