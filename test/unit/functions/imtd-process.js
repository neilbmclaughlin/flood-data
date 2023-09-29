'use strict'

const Lab = require('@hapi/lab')
const { after, afterEach, before, beforeEach, experiment, test } = (exports.lab = Lab.script())
const { expect } = require('@hapi/code')
const {
  stations: testStations,
  apiResponse: testApiResponse,
  apiNoMatchingThresholdResponse: testApiNoMatchingThresholdResponse
} = require('../../data/imtd-stations')
const axios = require('axios')
const proxyquire = require('proxyquire')
const mockDb = require('mock-knex')
const db = require('../../../lib/helpers/db')
const tracker = mockDb.getTracker()

const sinon = require('sinon')

function setupStdDbStubs (test) {
  const stations = test || testStations
  const methodCounter = {}
  tracker.on('query', function (query) {
    const responses = {
      select: stations,
      insert: [],
      del: []
    }
    const method = query.method || query.sql.toLowerCase().replace(';', '')
    methodCounter[method] = methodCounter[method] ? methodCounter[method] + 1 : 1
    query.response(responses[query.method])
  })
  return methodCounter
}

function setupAxiosStdStub (response = testApiResponse) {
  return sinon.stub(axios, 'get').resolves(response)
}

function setupHandlerWithStubs () {
  const logger = {
    info: sinon.stub(),
    error: sinon.stub()
  }
  const invokeLambda = sinon.stub().resolves()
  const { handler } = proxyquire('../../../lib/functions/imtd-process', {
    '../helpers/logging': logger,
    '../helpers/invoke-lambda': invokeLambda
  })

  return { handler, logger, invokeLambda }
}

experiment('imtd processing', () => {
  before(() => {
    mockDb.mock(db)
  })

  after(() => {
    mockDb.unmock(db)
  })

  beforeEach(async () => {
    tracker.install()
  })
  afterEach(() => {
    delete process.env.IMTD_BATCH_SIZE
    sinon.restore()
    tracker.uninstall()
  })

  experiment('happy path', () => {
    test('it should handle a response with no thresholds', async () => {
      const { handler } = setupHandlerWithStubs()
      setupAxiosStdStub(testApiNoMatchingThresholdResponse)
      const counter = setupStdDbStubs([{ rloi_id: 1001 }])
      await handler()
      expect(counter).to.equal({ select: 1, del: 1 })
    })
    test('it should select, delete and insert from DB in order and with expected values', async () => {
      tracker.on('query', function (query, step) {
        [
          () => {
            expect(query.method).to.equal('select')
            expect(query.sql).to.equal('select distinct "rloi_id" from "rivers_mview" where "rloi_id" is not null order by "rloi_id" asc limit $1')
            expect(query.bindings).to.equal([500])
            query.response([
              { rloi_id: 1001 }
            ])
          },
          () => {
            expect(query.sql).to.equal('BEGIN;')
            query.response()
          },
          () => {
            expect(query.method).to.equal('del')
            expect(query.sql).to.equal('delete from "station_imtd_threshold" where "station_id" = $1')
            expect(query.bindings).to.equal([1001])
            query.response([])
          },
          () => {
            expect(query.method).to.equal('insert')
            expect(query.sql).to.equal('insert into "station_imtd_threshold" ("direction", "fwis_code", "fwis_type", "station_id", "value") values ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15), ($16, $17, $18, $19, $20), ($21, $22, $23, $24, $25), ($26, $27, $28, $29, $30)')
            expect(query.bindings).to.equal([
              'u', '065WAF423', 'A', 1001, 33.4,
              'u', '065WAF423', 'A', 1001, 33.9,
              'u', '065WAF423', 'A', 1001, 34.2,
              'u', '065FWF5001', 'W', 1001, 34.4,
              'u', '065FWF5001', 'W', 1001, 34.9,
              'u', '065FWF5001', 'W', 1001, 35.2
            ])
            query.response([])
          },
          () => {
            expect(query.sql).to.equal('COMMIT;')
            query.response()
          }
        ][step - 1]()
      })

      const { handler } = setupHandlerWithStubs()
      setupAxiosStdStub()
      await handler()
    })
    test('for multiple RLOI ids it should select, delete and insert from DB as expected', async () => {
      const { handler } = setupHandlerWithStubs()
      const counter = setupStdDbStubs()
      const axiosStub = setupAxiosStdStub()
      await handler()
      // 8 stations each with the same 6 thresholds (out of 10 thresholds for inclusion)
      /// 1 select, 8 deletes and 8 inserts (6 thresholds per insert)
      expect(axiosStub.callCount).to.equal(8)
      expect(counter).to.equal({ begin: 8, select: 1, del: 8, insert: 8, commit: 8 })
    })
    test('it selects RLOI ids as expected with no offset', async () => {
      const { handler } = setupHandlerWithStubs()
      setupStdDbStubs()
      setupAxiosStdStub()

      const queries = []
      tracker.on('query', query => queries.push(query))
      await handler()

      expect(queries[0].sql).to.equal('select distinct "rloi_id" from "rivers_mview" where "rloi_id" is not null order by "rloi_id" asc limit $1')
      expect(queries[0].bindings).to.equal([500])
    })
    test('it selects RLOI ids as expected with an offset', async () => {
      const { handler } = setupHandlerWithStubs()
      setupStdDbStubs()
      setupAxiosStdStub()

      const queries = []
      tracker.on('query', query => queries.push(query))
      await handler({ offset: 1500 })

      expect(queries[0].sql).to.equal('select distinct "rloi_id" from "rivers_mview" where "rloi_id" is not null order by "rloi_id" asc limit $1 offset $2')
      expect(queries[0].bindings).to.equal([500, 1500])
    })
    test('it does not self invoke if number of rloi ids processed is less than batch size', async () => {
      process.env.IMTD_BATCH_SIZE = 10
      const { handler, invokeLambda } = setupHandlerWithStubs()
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'some-function-name'
      setupStdDbStubs(Array.from({ length: 9 }).map((v, i) => ({ rloi_id: 1000 + i })))
      setupAxiosStdStub()

      await handler({ offset: 20 })

      expect(invokeLambda.getCalls().length).to.equal(0)
    })
    test('it self invokes if number of rloi ids processed is equal to batch size', async () => {
      process.env.IMTD_BATCH_SIZE = 10
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'some-function-name'
      const { handler, invokeLambda } = setupHandlerWithStubs()
      setupStdDbStubs(Array.from({ length: 10 }).map((v, i) => ({ rloi_id: 1000 + i })))
      setupAxiosStdStub()

      await handler({ offset: 20 })

      expect(invokeLambda.getCalls().length).to.equal(1)
      expect(invokeLambda.getCalls()[0].args).to.equal(['some-function-name', { offset: 30 }])
    })
    test('it should log to info the details of inserts and deletes', async () => {
      setupStdDbStubs([{ rloi_id: 1001 }])
      setupAxiosStdStub()
      const { handler, logger } = setupHandlerWithStubs()

      await handler()
      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(3)
      expect(logInfoCalls[2].args[0]).to.equal('Processed 6 thresholds for RLOI id 1001')
    })
  })

  experiment('sad path', () => {
    test('it should log to info when API returns 404 for a given RLOI id', async () => {
      setupStdDbStubs([{ rloi_id: 1001 }])
      sinon.stub(axios, 'get').rejects({ response: { status: 404 } })
      const { handler, logger } = setupHandlerWithStubs()

      await handler()

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(4)
      expect(logInfoCalls[2].args[0]).to.equal('Station 1001 not found (HTTP Status: 404)')
      expect(logInfoCalls[3].args[0]).to.equal('Deleted thresholds for RLOI id 1001')

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(0)
    })
    test('it should log an error when API returns a status which is an error and not a 404', async () => {
      const counter = setupStdDbStubs([{ rloi_id: 1001 }])
      const axiosStub = setupAxiosStdStub()
      axiosStub.rejects({ response: { status: 500 } })
      const { handler, logger } = setupHandlerWithStubs()

      await handler()

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(1)
      expect(logErrorCalls[0].args[0]).to.equal('Could not process data for station 1001 (IMTD API request for station 1001 failed (HTTP Status: 500))')

      expect(counter, 'Should only select (i.e. not delete or insert) if there is a non 400 error from API').to.equal({ select: 1 })
    })
    test('it should log an error when network encounters an error', async () => {
      const counter = setupStdDbStubs([{ rloi_id: 1001 }])
      const axiosStub = setupAxiosStdStub()
      axiosStub.rejects(Error('getaddrinfo ENOTFOUND imfs-prd1-thresholds-api.azurewebsites.net'))
      const { handler, logger } = setupHandlerWithStubs()

      await handler()

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(1)
      expect(logErrorCalls[0].args[0]).to.equal('Could not process data for station 1001 (IMTD API request for station 1001 failed (Error: getaddrinfo ENOTFOUND imfs-prd1-thresholds-api.azurewebsites.net))')

      expect(counter, 'Should only select (i.e. not delete or insert) if there is a non 400 error from API').to.equal({ select: 1 })
    })
    test('it should process both RLOI ids even when first encounters an IMTD 500 error', async () => {
      const test = [
        { rloi_id: 1001 },
        { rloi_id: 1002 }
      ]

      const counter = setupStdDbStubs(test)
      const axiosStub = setupAxiosStdStub()
      axiosStub
        .onFirstCall().rejects({ response: { status: 500 } })
        .onSecondCall().resolves(testApiResponse)
      const { handler, logger } = setupHandlerWithStubs()

      await handler()

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(3)

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(1)
      expect(logErrorCalls[0].args[0]).to.equal('Could not process data for station 1001 (IMTD API request for station 1001 failed (HTTP Status: 500))')

      expect(counter).to.equal({ select: 1, begin: 1, del: 1, insert: 1, commit: 1 })
    })
    test('it should throw an error when IMTD response is not parsable', async () => {
      const counter = setupStdDbStubs([{ rloi_id: 1001 }])
      setupAxiosStdStub()
      const logger = {
        info: sinon.stub(),
        error: sinon.stub()
      }

      const { handler } = proxyquire('../../../lib/functions/imtd-process', {
        '../helpers/logging': logger,
        '../models/parse-thresholds': sinon.stub().throws(Error('Parsing Fail'))
      })

      await handler()

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(1)
      expect(logErrorCalls[0].args[0]).to.equal('Could not process data for station 1001 (Parsing Fail)')

      expect(counter, 'Should only select (i.e. not delete or insert) if the IMTD response is not parsable').to.equal({ select: 1 })
    })
    test('it should throw an error when DB connection fails when getting RLOI id\'s', async () => {
      tracker.on('query', function (query) {
        query.reject(Error('refused'))
      })
      sinon.stub(axios, 'get').rejects({ response: { status: 404 } })
      const { handler, logger } = setupHandlerWithStubs()

      const returnedError = await expect(handler()).to.reject()
      expect(returnedError.message).to.equal('Could not get list of id\'s from database (Error: select distinct "rloi_id" from "rivers_mview" where "rloi_id" is not null order by "rloi_id" asc limit $1 - refused)')

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(1)

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(0)
    })
    test('it should log an error and rollback when DB connection fails when deleting thresholds before inserting', async () => {
      tracker.on('query', function (query, step) {
        [
          () => {
            expect(query.method).to.equal('select')
            query.response([{ rloi_id: 1001 }])
          },
          () => {
            expect(query.sql).to.equal('BEGIN;')
            query.response()
          },
          () => {
            expect(query.method).to.equal('del')
            query.reject(Error('Delete Fail'))
          },
          () => {
            expect(query.sql).to.equal('ROLLBACK')
            query.response()
          }
        ][step - 1]()
      })
      setupAxiosStdStub()
      const { handler, logger } = setupHandlerWithStubs()

      await handler()

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(2)
      expect(logErrorCalls[0].args[0]).to.equal('Database error processing thresholds for station 1001')
      expect(logErrorCalls[1].args[0]).to.equal('Could not process data for station 1001 (delete from "station_imtd_threshold" where "station_id" = $1 - Delete Fail)')

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(2)
    })
    test('it should log an error when DB connection fails when deleting thresholds when there are no thresholds to insert', async () => {
      tracker.on('query', function (query, step) {
        [
          () => {
            expect(query.method).to.equal('select')
            query.response([{ rloi_id: 1001 }])
          },
          () => {
            expect(query.method).to.equal('del')
            query.reject(Error('Delete Fail'))
          }
        ][step - 1]()
      })
      setupAxiosStdStub(testApiNoMatchingThresholdResponse)
      const { handler, logger } = setupHandlerWithStubs()

      await handler()

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(2)
      expect(logErrorCalls[0].args[0]).to.equal('Error deleting thresholds for station 1001')
      expect(logErrorCalls[1].args[0]).to.equal('Could not process data for station 1001 (delete from "station_imtd_threshold" where "station_id" = $1 - Delete Fail)')

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(2)
    })
    test('it should log an error and rollback when DB connection fails when inserting thresholds', async () => {
      tracker.on('query', function (query, step) {
        [
          () => {
            expect(query.method).to.equal('select')
            query.response([{ rloi_id: 1001 }])
          },
          () => {
            expect(query.sql).to.equal('BEGIN;')
            query.response()
          },
          () => {
            expect(query.method).to.equal('del')
            query.response()
          },
          () => {
            expect(query.method).to.equal('insert')
            query.reject(Error('Insert Fail'))
          },
          () => {
            expect(query.sql).to.equal('ROLLBACK')
            query.response()
          }
        ][step - 1]()
      })
      setupAxiosStdStub()
      const { handler, logger } = setupHandlerWithStubs()

      await handler()

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(2)
      expect(logErrorCalls[0].args[0]).to.equal('Database error processing thresholds for station 1001')
      expect(logErrorCalls[1].args[0]).to.equal('Could not process data for station 1001 (insert into "station_imtd_threshold" ("direction", "fwis_code", "fwis_type", "station_id", "threshold_type", "value") values ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12), ($13, $14, $15, $16, $17, $18), ($19, $20, $21, $22, $23, $24), ($25, $26, $27, $28, $29, $30), ($31, $32, $33, $34, $35, $36) - Insert Fail)')

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(2)
    })
  })
})
