const s3 = require('../helpers/s3')
const util = require('../helpers/util')
const station = require('../models/station')
const { Pool } = require('../helpers/pool')

module.exports.handler = async (event) => {
  console.log('Received new event: ' + JSON.stringify(event))
  const bucket = event.Records[0].s3.bucket.name
  const key = event.Records[0].s3.object.key

  const data = await s3.getObject({ Bucket: bucket, Key: key })

  const stations = await util.parseCsv(data.Body.toString())

  const pool = new Pool({ connectionString: process.env.LFW_DATA_DB_CONNECTION })
  await station.saveToDb(stations, pool)
  // TODO there is a minor bug here that has a very low impact on front end
  // When deleting a station from the context file it is removed from the sharepoint site and database
  // Or when changing a station's telemetry ID
  // but the object is not removed from S3 which can cause some rarely seen funny behaviour
  await station.saveToObjects(stations, bucket, s3)
  await pool.end()
}
