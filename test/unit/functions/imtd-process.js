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

function setupHandlerWithLoggingStub () {
  const logger = {
    info: sinon.stub(),
    error: sinon.stub()
  }
  const { handler } = proxyquire('../../../lib/functions/imtd-process', {
    '../helpers/logging': logger
  })

  return { handler, logger }
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
    sinon.restore()
    tracker.uninstall()
  })

  experiment('happy path', () => {
    test('it should handle a response with no thresholds', async () => {
      const { handler } = setupHandlerWithLoggingStub()
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
            expect(query.sql).to.equal('select distinct "rloi_id" from "rivers_mview" where "rloi_id" is not null order by "rloi_id" asc')
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

      const { handler } = setupHandlerWithLoggingStub()
      setupAxiosStdStub()
      await handler()
    })
    test('for multiple RLOI ids it should select, delete and insert from DB as expected', async () => {
      const { handler } = setupHandlerWithLoggingStub()
      const counter = setupStdDbStubs()
      const axiosStub = setupAxiosStdStub()
      await handler()
      // 8 stations each with the same 6 thresholds (out of 10 thresholds for inclusion)
      /// 1 select, 8 deletes and 8 inserts (6 thresholds per insert)
      expect(axiosStub.callCount).to.equal(8)
      expect(counter).to.equal({ begin: 8, select: 1, del: 8, insert: 8, commit: 8 })
    })
    test('it should log to info the details of inserts and deletes', async () => {
      setupStdDbStubs([{ rloi_id: 1001 }])
      setupAxiosStdStub()
      const { handler, logger } = setupHandlerWithLoggingStub()

      await handler()
      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(1)
      expect(logInfoCalls[0].args[0]).to.equal('Processed 6 thresholds for RLOI id 1001')
    })
  })

  experiment('sad path', () => {
    test('it should log to info when API returns 404 for a given RLOI id', async () => {
      setupStdDbStubs([{ rloi_id: 1001 }])
      sinon.stub(axios, 'get').rejects({ response: { status: 404 } })
      const { handler, logger } = setupHandlerWithLoggingStub()

      await handler()

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(2)
      expect(logInfoCalls[0].args[0]).to.equal('Station 1001 not found (HTTP Status: 404)')
      expect(logInfoCalls[1].args[0]).to.equal('Deleted thresholds for RLOI id 1001')

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(0)
    })
    test('it should log an error when API returns a status which is an error and not a 404', async () => {
      const counter = setupStdDbStubs([{ rloi_id: 1001 }])
      const axiosStub = setupAxiosStdStub()
      axiosStub.rejects({ response: { status: 500 } })
      const { handler, logger } = setupHandlerWithLoggingStub()

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
      const { handler, logger } = setupHandlerWithLoggingStub()

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
      const { handler, logger } = setupHandlerWithLoggingStub()

      await handler()

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(1)

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
      const { handler, logger } = setupHandlerWithLoggingStub()

      const returnedError = await expect(handler()).to.reject()
      expect(returnedError.message).to.equal('Could not get list of id\'s from database (Error: select distinct "rloi_id" from "rivers_mview" where "rloi_id" is not null order by "rloi_id" asc - refused)')

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(0)

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
      const { handler, logger } = setupHandlerWithLoggingStub()

      await handler()

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(2)
      expect(logErrorCalls[0].args[0]).to.equal('Database error processing thresholds for station 1001')
      expect(logErrorCalls[1].args[0]).to.equal('Could not process data for station 1001 (delete from "station_imtd_threshold" where "station_id" = $1 - Delete Fail)')

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(0)
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
      const { handler, logger } = setupHandlerWithLoggingStub()

      await handler()

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(2)
      expect(logErrorCalls[0].args[0]).to.equal('Error deleting thresholds for station 1001')
      expect(logErrorCalls[1].args[0]).to.equal('Could not process data for station 1001 (delete from "station_imtd_threshold" where "station_id" = $1 - Delete Fail)')

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(0)
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
      const { handler, logger } = setupHandlerWithLoggingStub()

      await handler()

      const logErrorCalls = logger.error.getCalls()
      expect(logErrorCalls.length).to.equal(2)
      expect(logErrorCalls[0].args[0]).to.equal('Database error processing thresholds for station 1001')
      expect(logErrorCalls[1].args[0]).to.equal('Could not process data for station 1001 (insert into "station_imtd_threshold" ("direction", "fwis_code", "fwis_type", "station_id", "value") values ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15), ($16, $17, $18, $19, $20), ($21, $22, $23, $24, $25), ($26, $27, $28, $29, $30) - Insert Fail)')

      const logInfoCalls = logger.info.getCalls()
      expect(logInfoCalls.length).to.equal(0)
    })
  })
})
