const ngrToBng = require('ngr-to-bng')
const regions = require('../models/regions.json')
const rainfallPostfix = require('../models/rainfall-postfix.json')
const util = require('../helpers/util')
const directly = require('directly')

// telemetry parameters to import (Water level is if rloi station exists)
const parameters = ['Rainfall']

const processedValueDecimalPlace = 3

function getValuesCount (stations) {
  return stations.reduce((count, station) => count + (station.SetofValues || []).length, 0)
}

function removePostfix (name) {
  name = name.trimEnd()
  const postfix = rainfallPostfix.find(e => name.endsWith(` ${e}`))
  if (postfix) {
    return name.replace(` ${postfix}`, '')
  } else {
    return name
  }
}

async function fetchStation (s3, bucket, key) {
  return await s3.getObject({
    Bucket: bucket,
    Key: key
  })
}

function setSlsTelemetryStation (item) {
  // Convert ngr (national grid reference eg SK078993) to bng (British national grid eg 407800 399300)
  const point = item.$.ngr && ngrToBng(item.$.ngr)

  return [
    item.$.stationReference,
    item.$.region,
    removePostfix(item.$.stationName),
    item.$.ngr,
    point?.easting,
    point?.northing
  ]
}

function setSlsTelemetryValueItem (index, res, station, setOfValues) {
  const value = {
    telemetry_value_parent_id: res.rows[0].telemetry_value_parent_id,
    value: parseFloat(setOfValues.Value[index]._),
    processed_value: parseFloat(setOfValues.Value[index]._),
    value_timestamp: (new Date(`${setOfValues.Value[index].$.date}T${setOfValues.Value[index].$.time}Z`)).toJSON(),
    error: false
  }

  // Process values if they're Water Level
  if (setOfValues.$.parameter === 'Water Level') {
    // Subtract value if post process required
    if (station.Post_Process.toLowerCase() === 'y' || station.Post_Process.toLowerCase() === 'yes') {
      value.processed_value = station.Subtract ? parseFloat(util.toFixed(value.value - parseFloat(station.Subtract), processedValueDecimalPlace)) : value.value
    }
    if (!util.isNumeric(value.processed_value)) {
      value.processed_value = null
      value.error = true
    }
  }

  return value
}

function setSlsTelemetryParent (key, station, item, setOfValues) {
  return [
    key,
    new Date(),
    parseInt(station.RLOI_ID),
    item.$.stationReference,
    station.Region,
    new Date(`${setOfValues.$.startDate}T${setOfValues.$.startTime}Z`),
    new Date(`${setOfValues.$.endDate}T${setOfValues.$.endTime}Z`),
    setOfValues.$.parameter ? setOfValues.$.parameter : '',
    setOfValues.$.qualifier ? setOfValues.$.qualifier : '',
    setOfValues.$.units ? setOfValues.$.units : '',
    (station.Post_Process.toLowerCase() === 'y' || station.Post_Process.toLowerCase() === 'yes'),
    parseFloat(station.Subtract),
    parseFloat(station.POR_Max_Value),
    station.Station_Type,
    parseFloat(station.percentile_5),
    setOfValues.$.dataType ? setOfValues.$.dataType : '',
    setOfValues.$.period ? setOfValues.$.period : ''
  ]
}

module.exports = {
  async save (value, bucket, key, client, s3) {
    let processed = 0
    const concurrence = 3

    const valuesCount = getValuesCount(value.EATimeSeriesDataExchangeFormat.Station)

    console.log(valuesCount + ' values to process')

    if (valuesCount === 0) {
      return
    }

    for (const item of value.EATimeSeriesDataExchangeFormat.Station) {
      if (item.SetofValues) {
        // Update region to match station region as telemetry file region slightly differs,
        // so keep consistent with station data
        item.$.telemetryRegion = item.$.region
        item.$.region = regions[item.$.region] ? regions[item.$.region] : item.$.region

        await directly(concurrence, item.SetofValues.map(setOfValues => async () => {
          let station

          try {
            const result = await fetchStation(s3, bucket, `rloi/${item.$.region}/${item.$.stationReference}/station.json`)
            station = JSON.parse(result.Body)
          } catch (err) {
            // the console log is commented out so as not to spam the cloudwatch lambda
            // logging, as the s3.getObject throws an error when it can't find the object, and there
            // are a significant number of telemetry objects that we don't have a matching station
            // for, and also hence the need to catch the error here.
            // console.log({ err })
          }

          // only process the values if parameter in array or we have a station and Water level match (fsr-123)
          if (parameters.indexOf(setOfValues.$.parameter) > -1 || (station && setOfValues.$.parameter === 'Water Level')) {
            // if not rloi then Upsert station details to u_flood.sls_telemetry_station, with defaults for rloi specific values
            if (!station) {
              // dummy values
              station = {
                RLOI_ID: -1,
                Region: item.$.region,
                Post_Process: 'n',
                Station_Type: 'R'
              }

              const telemetryStation = setSlsTelemetryStation(item)

              await client.query('slsTelemetryStation', telemetryStation)
            }

            // Store parent details in sls_telemetry_value_parent
            const parent = setSlsTelemetryParent(key, station, item, setOfValues)

            const res = await client.query('slsTelemetryValueParent', parent)
            const values = []
            // console.log(`Loaded parent: ${station.RLOI_ID} | ${setOfValues.$.parameter} | ${setOfValues.$.qualifier}`)

            for (let i = 0; i < setOfValues.Value.length; i++) {
              values[i] = setSlsTelemetryValueItem(i, res, station, setOfValues)
            }

            // Note: this previously passed a single parameter as a query built using sql-node
            await client.query('slsTelemetryValues', values)
            // console.log(`Loaded station values: ${station.RLOI_ID} | ${setOfValues.$.parameter} | ${setOfValues.$.qualifier}`)
          }
          processed++
        }))
        if (processed === valuesCount) {
          console.log('all values processed')
        }
      }
    }
  },
  async deleteOld (client) {
    await client.query('deleteOldTelemetry')
  }
}
