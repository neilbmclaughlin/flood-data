const { parseStringPromise } = require('xml2js')
const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const fs = require('fs')

const util = require('../../../lib/helpers/util')
const rloi = require('../../../lib/models/rloi')
const { Pool: Client } = require('../../../lib/helpers/pool')
const s3 = require('../../../lib/helpers/s3')
const station = require('../../data/station.json')
const station2 = require('../../data/station2.json')
const coastalStation = require('../../data/station-coastal.json')
const sinon = require('sinon')
const {
  valuesSchemaQueryMatcher,
  valuesSchemaVarsMatcher,
  valueParentSchemaQueryMatcher,
  valueParentSchemaVarsMatcher,
  stationSchemaQueryMatcher,
  stationSchemaVarsMatcher
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
    .withArgs(stationSchemaQueryMatcher, stationSchemaVarsMatcher)
    .resolves()
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
    sinon.assert.callCount(client.query, 32)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 16)
    sinon.assert.callCount(client.query.withArgs(valuesSchemaQueryMatcher), 16)
  })

  lab.test('RLOI process no station match', async () => {
    sinon.restore()
    sinon.stub(s3, 'getObject').callsFake(() => {
      return Promise.resolve()
    })
    const client = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    // Will only process the Water level data as no station data returned therefore rloi data not needed (this is a bit over engineered)
    sinon.assert.callCount(client.query, 3)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
    sinon.assert.callCount(client.query.withArgs(valuesSchemaQueryMatcher), 1)
    sinon.assert.callCount(client.query.withArgs(stationSchemaQueryMatcher, stationSchemaVarsMatcher), 1)
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
      .withArgs(sinon.match(/^deleteOldTelemetry$/))
      .once(1)
      .resolves()
    await rloi.deleteOld(clientHelperMock)
  })

  lab.test('RLOI process with non numeric return', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test.xml'))
    const client = getStubbedDbHelper()
    sinon.stub(util, 'isNumeric').returns(false)
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query, 32)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 16)
    sinon.assert.callCount(client.query.withArgs(valuesSchemaQueryMatcher), 16)
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
    const values = [
      {
        telemetry_value_parent_id: 1,
        value: 1.986,
        processed_value: 1.486,
        value_timestamp: '2018-06-29T11:00:00.000Z',
        error: false
      }
    ]

    sinon.assert.calledOnceWithExactly(client.query.withArgs(valuesSchemaQueryMatcher, valuesSchemaVarsMatcher), 'slsTelemetryValues', values)
  })

  lab.test('negative processed values should not be errors', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    const client = getStubbedDbHelper()
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
    const values = [
      {
        telemetry_value_parent_id: 1,
        value: 1.986,
        processed_value: -0.014,
        value_timestamp: '2018-06-29T11:00:00.000Z',
        error: false
      }
    ]

    sinon.assert.calledOnceWithExactly(client.query.withArgs(valuesSchemaQueryMatcher, valuesSchemaVarsMatcher), 'slsTelemetryValues', values)
  })

  lab.test('non-numeric values should be flagged as an error', async () => {
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-single.xml'))
    file.EATimeSeriesDataExchangeFormat.Station[0].SetofValues[0].Value[0]._ = 'blah'
    const client = getStubbedDbHelper()
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
    const values = [
      {
        telemetry_value_parent_id: 1,
        value: NaN,
        processed_value: null,
        value_timestamp: '2018-06-29T11:00:00.000Z',
        error: true
      }
    ]

    sinon.assert.calledOnceWithExactly(client.query.withArgs(valuesSchemaQueryMatcher, valuesSchemaVarsMatcher), 'slsTelemetryValues', values)
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
    const values = [
      {
        telemetry_value_parent_id: 1,
        value: 1.986,
        processed_value: null,
        value_timestamp: '2018-06-29T11:00:00.000Z',
        error: true
      }
    ]

    sinon.assert.calledOnceWithExactly(client.query.withArgs(valuesSchemaQueryMatcher, valuesSchemaVarsMatcher), 'slsTelemetryValues', values)
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
    const values = [
      {
        telemetry_value_parent_id: 1,
        value: 1.986,
        processed_value: 1.986,
        value_timestamp: '2018-06-29T11:00:00.000Z',
        error: false
      }
    ]

    sinon.assert.calledOnceWithExactly(client.query.withArgs(valuesSchemaQueryMatcher, valuesSchemaVarsMatcher), 'slsTelemetryValues', values)
  })

  lab.test('Rainfall station and value is stored in DB and station name postfix is removed', async () => {
    sinon.restore()
    sinon.stub(s3, 'getObject').callsFake(() => {
      return Promise.resolve()
    })
    const client = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-rainfall-postfix.xml'))
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query, 3)
    sinon.assert.callCount(client.query.withArgs(valuesSchemaQueryMatcher), 1)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
    sinon.assert.callCount(client.query.withArgs(stationSchemaQueryMatcher, stationSchemaVarsMatcher), 1)
    const expectedStationQuery = {
      values: [
        '067015_TG 132',
        'North West',
        'Test station',
        'SJ3484041474',
        334840,
        341474
      ]
    }
    sinon.assert.calledOnceWithExactly(client.query.withArgs(stationSchemaQueryMatcher), 'slsTelemetryStation', expectedStationQuery.values)
  })

  lab.test('Rainfall station and value is stored in DB and station name without postfix', async () => {
    sinon.restore()
    sinon.stub(s3, 'getObject').callsFake(() => {
      return Promise.resolve()
    })
    const client = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-rainfall.xml'))
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query, 3)
    sinon.assert.callCount(client.query.withArgs(valuesSchemaQueryMatcher, valuesSchemaVarsMatcher), 1)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
    sinon.assert.callCount(client.query.withArgs(stationSchemaQueryMatcher, stationSchemaVarsMatcher), 1)
    const expectedStationQuery = {
      values: [
        '067015_TG 132',
        'North West',
        'Test station',
        'SJ3484041474',
        334840,
        341474
      ]
    }
    sinon.assert.calledOnceWithExactly(client.query.withArgs(stationSchemaQueryMatcher), 'slsTelemetryStation', expectedStationQuery.values)
  })

  lab.test('Rainfall station and value is stored in DB and station name with postfix in middle of name', async () => {
    sinon.restore()
    sinon.stub(s3, 'getObject').callsFake(() => {
      return Promise.resolve()
    })
    const client = getStubbedDbHelper()
    const file = await parseStringPromise(fs.readFileSync('./test/data/rloi-test-rainfall-postfix-middle.xml'))
    await rloi.save(file, 's3://devlfw', 'testkey', client, s3)
    sinon.assert.callCount(client.query, 3)
    sinon.assert.callCount(client.query.withArgs(valuesSchemaQueryMatcher), 1)
    sinon.assert.callCount(client.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 1)
    sinon.assert.callCount(client.query.withArgs(stationSchemaQueryMatcher, stationSchemaVarsMatcher), 1)
    const expectedStationQuery = {
      values: [
        '067015_TG 132',
        'North West',
        'Test PLUVIO RAINGAUGE station',
        'SJ3484041474',
        334840,
        341474
      ]
    }
    sinon.assert.calledOnceWithExactly(client.query.withArgs(stationSchemaQueryMatcher), 'slsTelemetryStation', expectedStationQuery.values)
  })
})
