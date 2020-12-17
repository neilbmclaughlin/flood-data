const { parseStringPromise } = require('xml2js')
const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const fs = require('fs')

const util = require('../../../lib/helpers/util')
const rloi = require('../../../lib/models/rloi')
const { Client } = require('pg')
const s3 = require('../../../lib/helpers/s3')
const station = require('../../data/station.json')
const station2 = require('../../data/station2.json')
const coastalStation = require('../../data/station-coastal.json')
const sinon = require('sinon')
const {
  valuesSchemaQueryMatcher,
  valueParentSchemaQueryMatcher,
  valueParentSchemaVarsMatcher
} = require('../../schemas/matchers')

function clone (a) {
  return JSON.parse(JSON.stringify(a))
}

function getStubbedDbHelper () {
  const client = sinon.createStubInstance(Client)
  // Note: using the sinon.createStubInstance(MyConstructor, overrides) form didn't work for some reason
  // hence using this slightly less terse form
  client.query
    .withArgs(valuesSchemaQueryMatcher)
    .resolves()
    .withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher)
    .resolves({ rows: [{ telemetry_value_parent_id: 1 }] })
  return client
}

lab.experiment('rloi model', () => {
  lab.beforeEach(() => {
    // setup mocks
    sinon.stub(s3, 'getObject').callsFake(() => {
      return Promise.resolve({ Body: JSON.stringify(station) })
    })
  })
  lab.afterEach(() => {
    sinon.verify()
    // Restore after each test is Sinon best practice at time of wrting
    // https://sinonjs.org/releases/v9.0.3/general-setup/
    sinon.restore()
  })

  lab.test('RLOI process', async () => {
    const client = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query, 40)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 20)
    sinon.assert.callCount(client.query.withArgs(valuesSchemaQueryMatcher), 20)
  })

  lab.test('single station with no set of values should not update db', async () => {
    const client = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-empty-single.xml'))
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query, 0)
  })

  lab.test('station with set of values should insert parent and value telemetry records in db', async () => {
    const client = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query, 2)
    sinon.assert.callCount(client.query.withArgs(valuesSchemaQueryMatcher), 1)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
  })

  lab.test('RLOI process no station', async () => {
    const client = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
  })

  lab.test('RLOI process no station', async () => {
    sinon.restore()
    sinon.stub(s3, 'getObject').callsFake(() => {
      return Promise.resolve({ Body: JSON.stringify(station2) })
    })
    const client = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
  })

  lab.test('RLOI process no station', async () => {
    sinon.restore()
    sinon.stub(s3, 'getObject').callsFake(() => {
      return Promise.resolve({ Body: JSON.stringify(coastalStation) })
    })
    const client = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
  })

  lab.test('RLOI delete Old', async () => {
    const clientHelperMock = sinon.createStubInstance(Client)
    clientHelperMock.query = sinon.mock()
      .withArgs(sinon.match(/^DELETE FROM u_flood.sls_telemetry_value_parent/))
      .once(1)
      .resolves()
    await rloi.deleteOld(clientHelperMock)
  })

  lab.test('RLOI process with non numeric return', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    const client = getStubbedDbHelper()
    sinon.stub(util, 'isNumeric').returns(false)
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query, 40)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 20)
    sinon.assert.callCount(client.query.withArgs(valuesSchemaQueryMatcher), 20)
  })

  lab.test('subtract values should be applied', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    const stationClone = clone(station)
    stationClone.Subtract = 0.5
    sinon.restore()
    sinon.stub(s3, 'getObject').callsFake(() => {
      return Promise.resolve({ Body: JSON.stringify(stationClone) })
    })

    const client = getStubbedDbHelper()
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
    const expectedQuery = {
      text: 'INSERT INTO "sls_telemetry_value" ("telemetry_value_parent_id", "value", "processed_value", "value_timestamp", "error") VALUES ($1, $2, $3, $4, $5)',
      values: [
        1,
        1.986,
        1.486,
        '2018-06-29T11:00:00.000Z',
        false
      ]
    }
    sinon.assert.calledOnceWithExactly(client.query.withArgs(valuesSchemaQueryMatcher), expectedQuery)
  })

  lab.test('negative processed values should not be errors', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    const client = getStubbedDbHelper()
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
    const expectedQuery = {
      text: 'INSERT INTO "sls_telemetry_value" ("telemetry_value_parent_id", "value", "processed_value", "value_timestamp", "error") VALUES ($1, $2, $3, $4, $5)',
      values: [
        1,
        1.986,
        -0.014,
        '2018-06-29T11:00:00.000Z',
        false
      ]
    }
    sinon.assert.calledOnceWithExactly(client.query.withArgs(valuesSchemaQueryMatcher), expectedQuery)
  })

  lab.test('non-numeric values should be flagged as an error', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    file.EATimeSeriesDataExchangeFormat.Station[0].SetofValues[0].Value[0]._ = 'blah'
    const client = getStubbedDbHelper()
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
    const expectedQuery = {
      text: 'INSERT INTO "sls_telemetry_value" ("telemetry_value_parent_id", "value", "processed_value", "value_timestamp", "error") VALUES ($1, $2, $3, $4, $5)',
      values: [
        1,
        NaN,
        null,
        '2018-06-29T11:00:00.000Z',
        true
      ]
    }
    sinon.assert.calledOnceWithExactly(client.query.withArgs(valuesSchemaQueryMatcher), expectedQuery)
  })

  lab.test('non-numeric subtract values should be be flagged as an error', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    const stationClone = clone(station)
    stationClone.Subtract = 'blah'
    sinon.restore()
    sinon.stub(s3, 'getObject').callsFake(() => {
      return Promise.resolve({ Body: JSON.stringify(stationClone) })
    })

    const client = getStubbedDbHelper()
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
    const expectedQuery = {
      text: 'INSERT INTO "sls_telemetry_value" ("telemetry_value_parent_id", "value", "processed_value", "value_timestamp", "error") VALUES ($1, $2, $3, $4, $5)',
      values: [
        1,
        1.986,
        null,
        '2018-06-29T11:00:00.000Z',
        true
      ]
    }
    sinon.assert.calledOnceWithExactly(client.query.withArgs(valuesSchemaQueryMatcher), expectedQuery)
  })

  lab.test('empty subtract values should be ignored', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    const stationClone = clone(station)
    stationClone.Subtract = ''
    sinon.restore()
    sinon.stub(s3, 'getObject').callsFake(() => {
      return Promise.resolve({ Body: JSON.stringify(stationClone) })
    })
    const client = getStubbedDbHelper()
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
    const expectedQuery = {
      text: 'INSERT INTO "sls_telemetry_value" ("telemetry_value_parent_id", "value", "processed_value", "value_timestamp", "error") VALUES ($1, $2, $3, $4, $5)',
      values: [
        1,
        1.986,
        1.986,
        '2018-06-29T11:00:00.000Z',
        false
      ]
    }
    sinon.assert.calledOnceWithExactly(client.query.withArgs(valuesSchemaQueryMatcher), expectedQuery)
  })
})
