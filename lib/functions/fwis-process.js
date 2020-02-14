const db = new (require('../helpers/db'))()
const fwis = new (require('../models/fwis'))(db)
const util = new (require('../helpers/util'))()
const wreck = require('../helpers/wreck')

module.exports.handler = async (event) => {
  // const bucket = event.Records[0].s3.bucket.name
  // const key = event.Records[0].s3.object.key
  // const data = await s3.getObject({ Bucket: bucket, Key: key })

//  const timestamp = key.substring(key.indexOf('/fwis-') + 6, key.indexOf('.xml'))

  const { warnings } = await wreck.request('get', 'https://prdfws-agw.prd.defra.cloud/fwis.json', { 
    json: true,
    headers: {
      'x-api-key': process.env.LFW_FWIS_API_KEY
    }
  }, true)

  // Get the current seconds since epoch
  const timestamp = Math.round((new Date()).getTime() / 1000)

  await fwis.save(warnings, timestamp)
  await db.end()
}
