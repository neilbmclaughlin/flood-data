const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const lab = exports.lab = Lab.script()
const fs = require('fs')
const rloiValueParentSchema = require('../../schemas/rloi-value-parent')
const rloiValuesSchema = require('../../schemas/rloi-values')

const util = new (require('../../../lib/helpers/util'))()
const Rloi = require('../../../lib/models/rloi')
const Db = require('../../../lib/helpers/db')
const S3 = require('../../../lib/helpers/s3')
const station = require('../../data/station.json')
const station2 = require('../../data/station2.json')
const coastalStation = require('../../data/station-coastal.json')
const sinon = require('sinon')

function getStubbedS3Helper () {
  return sinon.createStubInstance(S3)
}

function getStubbedS3HelperGetObject (station) {
  const stub = getStubbedS3Helper()
  stub.getObject.resolves({ Body: JSON.stringify(station) })
  return stub
}

const valueParentSchemaQueryMatcher = sinon.match((matchValue) => {
  const { value, error } = rloiValueParentSchema.query.validate(matchValue)
  console.log({ matcher: 'valueParentSchemaQueryMatcher', matchValue, value, error })
  return error === undefined
}, 'parent query does not match expected schema')

const valueParentSchemaVarsMatcher = sinon.match((matchValue) => {
  const { value, error } = rloiValueParentSchema.vars.validate(matchValue)
  console.log({ matcher: 'valueParentSchemaVarsMatcher', matchValue, value, error })
  return error === undefined
}, 'parent vars does not match expected schema')

const valuesSchemaQueryMatcher = sinon.match((matchValue) => {
  const { value, error } = rloiValuesSchema.query.validate(matchValue)
  console.log({ matcher: 'valuesSchemaQueryMatcher', matchValue, value, error })
  return error === undefined
}, 'Values query does not match expected schema')

function getMockedDbHelper () {
  const stub = sinon.createStubInstance(Db)
  // the query1 method has been introduced into the model and should not be needed
  // it should be possible to have multiple withArgs and resolves statements
  // but this is not currently working in that all calls match the two arg
  // signature even when they ony have one arg.
  // Having a seperate method sidesteps this problem
  // Haven't got to the bottom of this yet
  stub.query1 = sinon.stub()
    .withArgs(valuesSchemaQueryMatcher)
    .resolves()
  stub.query = sinon.stub()
    .withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher)
    .resolves({ rows: [{ telemetry_value_parent_id: 1 }] })
  return stub
}

lab.experiment('rloi model', () => {
  lab.afterEach(() => {
    sinon.verify()
    sinon.restore()
  })

  lab.experiment('matchers', () => {
    lab.test('valueParentSchemaQueryMatcher should match', async () => {
      const query = 'INSERT INTO sls_telemetry_value_parent(filename, imported, rloi_id, station, region, start_timestamp, end_timestamp, parameter, qualifier, units, post_process, subtract, por_max_value, station_type, percentile_5) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING telemetry_value_parent_id'
      Code.expect(valueParentSchemaQueryMatcher.test(query)).to.be.true()
    })
    lab.test('valueParentSchemaQueryMatcher should not match', async () => {
      const query = {
        text: 'INSERT INTO "sls_telemetry_value" ("telemetry_value_parent_id", "value", "processed_value", "value_timestamp", "error") VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15), ($16, $17, $18, $19, $20)',
        values: [1, 1.986, null, '2018-06-29T10:15:00.000Z', true, 1, 1.986, null, '2018-06-29T10:30:00.000Z', true, 1, 1.986, null, '2018-06-29T10:45:00.000Z', true, 1, 1.986, null, '2018-06-29T11:00:00.000Z', true]
      }
      Code.expect(valueParentSchemaQueryMatcher.test(query)).to.be.false()
    })
    lab.test('valueParentSchemaVarMatcher', async () => {
      const vars = [
        'testkey',
        'Tue Sep 15 2020 08:37:13 GMT+0100 (British Summer Time)',
        5075,
        'test1',
        'North West',
        'Fri Jun 29 2018 11:15:00 GMT+0100 (British Summer Time)',
        'Fri Jun 29 2018 12:00:00 GMT+0100 (British Summer Time)',
        'Water Level',
        'Stage',
        'm',
        true,
        2,
        3.428,
        'S',
        1.6
      ]
      Code.expect(valueParentSchemaVarsMatcher.test(vars)).to.be.true()
    })
    lab.test('valueParentSchemaVarMatcher', async () => {
      Code.expect(valueParentSchemaVarsMatcher.test(undefined)).to.be.false()
    })
    lab.experiment('valuesSchemaQueryMatcher', async () => {
      lab.test('insert into sls_telemetry_value should match', async () => {
        const query = {
          text: 'INSERT INTO "sls_telemetry_value" ("telemetry_value_parent_id", "value", "processed_value", "value_timestamp", "error") VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15), ($16, $17, $18, $19, $20)',
          values: [1, 1.986, null, '2018-06-29T10:15:00.000Z', true, 1, 1.986, null, '2018-06-29T10:30:00.000Z', true, 1, 1.986, null, '2018-06-29T10:45:00.000Z', true, 1, 1.986, null, '2018-06-29T11:00:00.000Z', true]
        }
        Code.expect(valuesSchemaQueryMatcher.test(query)).to.be.true()
      })
      lab.test('insert into sls_telemetry_value_parent should not match', async () => {
        const query = 'INSERT INTO sls_telemetry_value_parent(filename, imported, rloi_id, station, region, start_timestamp, end_timestamp, parameter, qualifier, units, post_process, subtract, por_max_value, station_type, percentile_5) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING telemetry_value_parent_id'
        Code.expect(valuesSchemaQueryMatcher.test(query)).to.be.false()
      })
      lab.test('empty query object should not match', async () => {
        const query = {}
        Code.expect(valuesSchemaQueryMatcher.test(query)).to.be.false()
      })
    })
  })

  lab.test('RLOI process', async () => {
    const db = getMockedDbHelper()
    const s3 = getStubbedS3HelperGetObject(station)
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-test.xml'))
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
    sinon.assert.callCount(db.query.withArgs(valueParentSchemaQueryMatcher, valueParentSchemaVarsMatcher), 20)
    sinon.assert.callCount(db.query1.withArgs(valuesSchemaQueryMatcher), 20)
  })

  lab.test('RLOI process empty values', async () => {
    const db = getMockedDbHelper()
    const s3 = getStubbedS3HelperGetObject(station)
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-empty.xml'))
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
  })

  lab.test('RLOI process no station', async () => {
    const s3 = getStubbedS3Helper()
    const db = getMockedDbHelper()
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-test.xml'))
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
  })

  lab.test('RLOI process no station', async () => {
    const s3 = getStubbedS3HelperGetObject(station2)
    const db = getMockedDbHelper()
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-test.xml'))
    const rloi = new Rloi(db, s3, util)
    await rloi.save(file, 's3://devlfw', 'testkey')
  })

  lab.test('RLOI process no station', async () => {
    const s3 = getStubbedS3HelperGetObject(coastalStation)
    const db = getMockedDbHelper()
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-test.xml'))
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
    const s3 = new S3()
    const db = getMockedDbHelper()
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-test.xml'))
    const Util2 = require('../../../lib/helpers/util')
    sinon.stub(Util2.prototype, 'isNumeric').callsFake(() => {
      console.log('in util 2 stub')
      return false
    })
    const util2 = new Util2()
    util2.isNumeric()
    const rloi = new Rloi(db, s3, util2)
    await rloi.save(file, 's3://devlfw', 'testkey')
  })
})
