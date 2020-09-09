const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
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
// start up Sinon sandbox
const sinon = require('sinon')

function getStubS3 (station) {
  return sinon.createStubInstance(S3)
}

function getStubS3getObject (station) {
  const stub = getStubS3()
  stub.getObject = sinon.stub().resolves({ Body: JSON.stringify(station) })
  return stub
}

lab.experiment('rloi model', () => {
  lab.beforeEach(() => {
    sinon.stub(Db.prototype, 'query').callsFake((query, vars) => {
      let resultQuery, resultVars
      if (typeof query === 'object') {
        // test values insert
        resultQuery = rloiValuesSchema.query.validate(query)
      } else {
        // test value parent insert
        resultQuery = rloiValueParentSchema.query.validate(query)
        resultVars = rloiValueParentSchema.vars.validate(vars)
      }
      Code.expect(resultQuery.error).to.be.undefined()
      if (resultVars) {
        Code.expect(resultVars.error).to.be.undefined()
      }

      return new Promise((resolve, reject) => {
        resolve({
          rows: [{
            telemetry_value_parent_id: 1
          }]
        })
      })
    })
  })

  lab.afterEach(() => {
    sinon.restore()
  })

  lab.test('RLOI process', async () => {
    const db = new Db(true)
    const s3 = getStubS3(station)
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-test.xml'))
    const rloi = new Rloi(db, s3, util)
    rloi.save(file, 's3://devlfw', 'testkey')
  })

  lab.test('RLOI process empty values', async () => {
    const db = new Db(true)
    const s3 = getStubS3getObject(station)
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-empty.xml'))
    const rloi = new Rloi(db, s3, util)
    rloi.save(file, 's3://devlfw', 'testkey')
  })

  lab.test('RLOI process no station', async () => {
    const s3 = getStubS3()
    const db = new Db(true)
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-test.xml'))
    const rloi = new Rloi(db, s3, util)
    rloi.save(file, 's3://devlfw', 'testkey')
  })

  lab.test('RLOI process no station', async () => {
    const s3 = getStubS3getObject(station2)
    const db = new Db(true)
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-test.xml'))
    const rloi = new Rloi(db, s3, util)
    rloi.save(file, 's3://devlfw', 'testkey')
  })

  lab.test('RLOI process no station', async () => {
    const s3 = getStubS3getObject(coastalStation)
    const db = new Db(true)
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-test.xml'))
    const rloi = new Rloi(db, s3, util)
    rloi.save(file, 's3://devlfw', 'testkey')
  })

  lab.test('RLOI delete Old', async () => {
    const db = new Db(true)
    const rloi = new Rloi(db)
    rloi.deleteOld()
  })

  lab.test('RLOI process with non numeric return', async () => {
    const s3 = new S3()
    const db = new Db(true)
    const file = await util.parseXml(fs.readFileSync('./test/data/rloi-test.xml'))
    const Util2 = require('../../../lib/helpers/util')
    sinon.stub(Util2.prototype, 'isNumeric').callsFake(() => {
      console.log('in util 2 stub')
      return false
    })
    const util2 = new Util2()
    util2.isNumeric()
    const rloi = new Rloi(db, s3, util2)
    rloi.save(file, 's3://devlfw', 'testkey')
  })
})
