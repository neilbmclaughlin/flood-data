const { parseStringPromise } = require('xml2js')
const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const fs = require('fs')

const util = new (require('../../../lib/helpers/util'))()
const Rloi = require('../../../lib/models/rloi')
const Db = require('../../../lib/helpers/db')
const S3 = require('../../../lib/helpers/s3')
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

function getStubbedS3Helper () {
  return sinon.createStubInstance(S3)
}

function getStubbedS3HelperGetObject (station) {
  const stub = getStubbedS3Helper()
  stub.getObject.resolves({ Body: JSON.stringify(station) })
  return stub
}

function getStubbedDbHelper () {
  const db = sinon.createStubInstance(Db)
  // Note: using the sinon.createStubInstance(MyConstructor, overrides) form didn't work for some reason
  // hence using this slightly less terse form
  db.query
    .withArgs(valuesSchemaQueryMatcher)
    .resolves()
    .withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher)
    .resolves({ rows: [{ telemetry_value_parent_id: 1 }] })
  return db
}

lab.experiment('rloi model', () => {
  lab.afterEach(() => {
    sinon.verify()
    // Restore after each test is Sinon best practice at time of wrting
    // https://sinonjs.org/releases/v9.0.3/general-setup/
    sinon.restore()
  })

  lab.test('RLOI process', async () => {
    const db = getStubbedDbHelper()
    const s3 = getStubbedS3HelperGetObject(station)
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
    sinon.assert.callCount(db.query, 40)
    sinon.assert.callCount(db.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 20)
    sinon.assert.callCount(db.query.withArgs(valuesSchemaQueryMatcher), 20)
  })

  lab.test('single station with no set of values should not update db', async () => {
    const db = getStubbedDbHelper()
    const s3 = getStubbedS3HelperGetObject(station)
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-empty-single.xml'))
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
    sinon.assert.callCount(db.query, 0)
  })

  lab.test('station with set of values should insert parent and value telemetry records in db', async () => {
    const db = getStubbedDbHelper()
    const s3 = getStubbedS3HelperGetObject(station)
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
    sinon.assert.callCount(db.query, 2)
    sinon.assert.callCount(db.query.withArgs(valuesSchemaQueryMatcher), 1)
    sinon.assert.callCount(db.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
  })

  lab.test('RLOI process no station', async () => {
    const s3 = getStubbedS3Helper()
    const db = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
  })

  lab.test('RLOI process no station', async () => {
    const s3 = getStubbedS3HelperGetObject(station2)
    const db = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
  })

  lab.test('RLOI process no station', async () => {
    const s3 = getStubbedS3HelperGetObject(coastalStation)
    const db = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
  })

  lab.test('RLOI delete Old', async () => {
    const dbHelperMock = sinon.createStubInstance(Db)
    dbHelperMock.query = sinon.mock()
      .withArgs(sinon.match(/^DELETE FROM u_flood.sls_telemetry_value_parent/))
      .once(1)
      .resolves()
    const rloi = new Rloi(dbHelperMock)
    await rloi.deleteOld()
  })

  lab.test('RLOI process with non numeric return', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    const s3 = getStubbedS3HelperGetObject(station)
    const db = getStubbedDbHelper()
    sinon.stub(util, 'isNumeric').returns(false)
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
    sinon.assert.callCount(db.query, 40)
    sinon.assert.callCount(db.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 20)
    sinon.assert.callCount(db.query.withArgs(valuesSchemaQueryMatcher), 20)
  })

  lab.test('subtract values should be applied', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    const stationClone = clone(station)
    stationClone.Subtract = 0.5

    const s3 = getStubbedS3HelperGetObject(stationClone)
    const db = getStubbedDbHelper()
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
    sinon.assert.callCount(db.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
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
    sinon.assert.calledOnceWithExactly(db.query.withArgs(valuesSchemaQueryMatcher), expectedQuery)
  })
  lab.test('negative processed values should not be errors', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    const s3 = getStubbedS3HelperGetObject(station)
    const db = getStubbedDbHelper()
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
    sinon.assert.callCount(db.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
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
    sinon.assert.calledOnceWithExactly(db.query.withArgs(valuesSchemaQueryMatcher), expectedQuery)
  })

  lab.test('non-numeric values should be flagged as an error', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    file.EATimeSeriesDataExchangeFormat.Station[0].SetofValues[0].Value[0]._ = 'blah'

    const s3 = getStubbedS3HelperGetObject(station)
    const db = getStubbedDbHelper()
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
    sinon.assert.callCount(db.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
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
    sinon.assert.calledOnceWithExactly(db.query.withArgs(valuesSchemaQueryMatcher), expectedQuery)
  })

  lab.test('non-numeric subtract values should be be flagged as an error', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    const stationClone = clone(station)
    stationClone.Subtract = 'blah'

    const s3 = getStubbedS3HelperGetObject(stationClone)
    const db = getStubbedDbHelper()
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
    sinon.assert.callCount(db.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
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
    sinon.assert.calledOnceWithExactly(db.query.withArgs(valuesSchemaQueryMatcher), expectedQuery)
  })

  lab.test('empty subtract values should be ignored', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    const stationClone = clone(station)
    stationClone.Subtract = ''

    const s3 = getStubbedS3HelperGetObject(stationClone)
    const db = getStubbedDbHelper()
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
    sinon.assert.callCount(db.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
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
    sinon.assert.calledOnceWithExactly(db.query.withArgs(valuesSchemaQueryMatcher), expectedQuery)
  })
})
