const pg = require('./db')
const axios = require('axios')
const { HTTP_NOT_FOUND } = require('../constants')
const logger = require('./logging')
const parseStation = require('../models/parse-time-series')
const Joi = require('joi')

async function deleteStation (stationId, tableName) {
  await pg(tableName).where({ station_id: stationId }).delete()
}

async function getRloiIds ({ limit, offset } = {}) {
  try {
    const result = await pg('rivers_mview')
      .distinct('rloi_id')
      .whereNotNull('rloi_id')
      .orderBy('rloi_id', 'asc')
      .limit(limit)
      .offset(offset)
    return result
  } catch (error) {
    throw Error(`Could not get list of id's from database (Error: ${error.message})`)
  }
}

async function getImtdApiResponse (stationId) {
  const hostname = 'imfs-prd1-thresholds-api.azurewebsites.net'
  try {
    return await axios.get(`https://${hostname}/Location/${stationId}?version=2`)
  } catch (error) {
    if (error.response?.status === HTTP_NOT_FOUND) {
      logger.info(`Station ${stationId} not found (HTTP Status: 404)`)
    } else {
      const message = error.response?.status ? `HTTP Status: ${error.response.status}` : `Error: ${error.message}`
      throw Error(`IMTD API request for station ${stationId} failed (${message})`)
    }
    return {}
  }
}

async function getStationData (stationId) {
  const response = await getImtdApiResponse(stationId)
  if (response.data) {
    return parseStation(response.data[0].TimeSeriesMetaData, stationId)
  }
  return []
}

async function validateStationData (stationDataArray) {
  const schema = Joi.object({
    station_id: Joi.number().required(),
    direction: Joi.string().required(),
    display_time_series: Joi.boolean().required()
  })

  try {
    const validatedData = await Promise.all(
      stationDataArray.map((stationData) => schema.validateAsync(stationData))
    )
    return validatedData
  } catch (error) {
    throw new Error(`Validation error: ${error.message}`)
  }
}

module.exports = { deleteStation, getRloiIds, getImtdApiResponse, getStationData, validateStationData }
