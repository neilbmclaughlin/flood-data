const Lab = require('@hapi/lab')
const { describe, it, before, after, beforeEach, afterEach } = exports.lab = Lab.script()
const { expect } = require('@hapi/code')
const sinon = require('sinon')
const event = require('../events/rloi-event.json')
const station = require('../data/station.json')
const s3 = require('../../lib/helpers/s3')
const fs = require('fs')
const { Client } = require('pg')
const { handler } = require('../../lib/functions/rloi-process')

const getRows = async (client) => {
  const { rows: stations } = await client.query('select * from u_flood.sls_telemetry_station;')
  const { rows: parents } = await client.query('select * from u_flood.sls_telemetry_value_parent;')
  const { rows: values } = await client.query('select * from u_flood.sls_telemetry_value order by value_timestamp;')
  const { rows: valueParents } = await client.query('select * from u_flood.sls_telemetry_value_parent tvp join u_flood.sls_telemetry_value tv on tvp.telemetry_value_parent_id = tv.telemetry_value_parent_id order by tvp.telemetry_value_parent_id asc, tv.telemetry_value_id asc;')
  return { stations, parents, values, valueParents }
}

async function getCounts (client) {
  const { stations, parents, values, valueParents } = await getRows(client)
  return {
    stations: stations.length,
    parents: parents.length,
    values: values.length,
    valueParents: valueParents.length
  }
}

function stripVolatileProperties (rows) {
  return rows.map((row) => {
    const rowClone = clone(row)
    delete rowClone.telemetry_value_parent_id
    delete rowClone.telemetry_value_id
    // need to remove imported date as it is set to now which changes with each run
    // and so can not easit be asserted
    delete rowClone.imported
    return rowClone
  })
}

function sortFunction (a, b) {
  if (a.rloi_id !== b.rloi_id) {
    return a.rloi_id - b.rloi_id
  }

  if (a.station_type !== b.station_type) {
    return a.station_type.localeCompare(b.station_type)
  }

  if (a.qualifier !== b.qualifier) {
    return a.qualifier.localeCompare(b.qualifier)
  }

  return new Date(a.value_timestamp) - new Date(b.value_timestamp)
}

function clone (a) {
  return JSON.parse(JSON.stringify(a))
}

async function truncateTables (client) {
  await client.query('TRUNCATE u_flood.sls_telemetry_station;')
  await client.query('TRUNCATE u_flood.sls_telemetry_value_parent RESTART IDENTITY CASCADE;')
}

describe('Test rloiProcess handler', () => {
  before(async ({ context }) => {
    context.client = new Client({ connectionString: process.env.LFW_DATA_DB_CONNECTION })
    context.client.connect()
    // need to alter the ownership of the sequences for the 'truncate ... cascade restart identity to work
    await context.client.query('alter sequence u_flood.sls_telemetry_value_parent_telemetry_value_parent_id_seq owned by sls_telemetry_value_parent.telemetry_value_parent_id;')
    await context.client.query('alter sequence u_flood.sls_telemetry_value_telemetry_value_id_seq owned by sls_telemetry_value.telemetry_value_id;')
  })
  beforeEach(async ({ context }) => {
    truncateTables(context.client)
  })
  afterEach(async ({ context }) => {
    sinon.restore()
  })
  after(async ({ context }) => {
    await context.client.end()
  })
  it('it should insert single record into DB as expected', async ({ context }) => {
    const { client } = context
    const file = fs.readFileSync('./test/data/rloi-test-single.xml', 'utf8')
    sinon.stub(s3, 'getObject')
      .onFirstCall().resolves({ Body: file })
      .onSecondCall().resolves({ Body: JSON.stringify(station) })
    expect(await getCounts(client)).to.equal({ stations: 0, parents: 0, values: 0, valueParents: 0 })
    await handler(event)
    // await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    // expect(await getCounts(client)).to.equal({ stations: 0, parents: 16, values: 57, valueParents: 57 })
    expect(await getCounts(client)).to.equal({ stations: 0, parents: 1, values: 1, valueParents: 1 })
    const results = await getRows(client)
    expect(stripVolatileProperties(results.valueParents)[0]).to.equal({
      filename: 'fwfidata/rloi/NWTSNWFS20210112103440355.XML',
      rloi_id: 5075,
      station: '067015_TG 132',
      region: 'North West',
      start_timestamp: '2018-10-03T09:15:00.000Z',
      end_timestamp: '2018-10-03T09:30:00.000Z',
      parameter: 'Water Level',
      qualifier: 'Stage',
      units: 'm',
      post_process: true,
      subtract: '2.000',
      por_max_value: '3.428',
      station_type: 'S',
      percentile_5: '1.600',
      data_type: 'Instantaneous',
      period: '15 min',
      value: '1.986',
      processed_value: '-0.014',
      value_timestamp: '2018-06-29T11:00:00.000Z',
      error: false
    })
  })
  it('it should insert multiple records into DB as expected', async ({ context }) => {
    const { client } = context
    const telemetryResponse = fs.readFileSync('./test/data/rloi-test.xml', 'utf8')
    sinon.stub(s3, 'getObject')
      .withArgs({
        Bucket: event.Records[0].s3.bucket.name,
        Key: event.Records[0].s3.object.key
      }).resolves({ Body: telemetryResponse })
      .withArgs(sinon.match({
        Bucket: event.Records[0].s3.bucket.name,
        Key: sinon.match(/^rloi\/.*\/.*\/station\.json/)
      })).callsFake(async (x) => {
        // in order to check the DB inserts are correct we need to ensure that the RLOI id
        // for the station matches that in the XML document and this comes from the key for the
        // the requested S3 document:
        // rloi/${item.$.region}/${item.$.stationReference}/station.json
        // Note that all other station properties remain fixed for all responses
        const rloiId = x.Key.split('/')[2]
        return {
          Body: JSON.stringify({ ...station, RLOI_ID: rloiId })
        }
      })
    const dateReviver = (key, value) => key.endsWith('_timestamp') ? new Date(value) : value
    const checkList = JSON.parse(fs.readFileSync('./test/integration/data/parent-values.json', 'utf8'), dateReviver)
    expect(await getCounts(client)).to.equal({ stations: 0, parents: 0, values: 0, valueParents: 0 })

    await handler(event)
    expect(await getCounts(client)).to.equal({ stations: 0, parents: 16, values: 57, valueParents: 57 })

    const results = await getRows(client)
    expect(stripVolatileProperties(results.valueParents).sort(sortFunction)).to.equal(stripVolatileProperties(checkList).sort(sortFunction))

    // fs.writeFileSync('./test/integration/data/parent-values.json', JSON.stringify(results.valueParents, null, 2))
  })
})
