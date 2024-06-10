'use strict'

const Lab = require('@hapi/lab')
const { after, afterEach, before, beforeEach, experiment, test } = (exports.lab = Lab.script())
const { expect } = require('@hapi/code')
const { validateStationData } = require('../../../lib/functions/dts-process')
const { getImtdApiResponse } = require('../../../lib/helpers/imtd-api')

const {
  stations: testStations,
  apiResponse: testApiResponse,

  api404
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
  const { handler } = proxyquire('../../../lib/functions/dts-process', {
    '../helpers/logging': logger,
    '../helpers/invoke-lambda': invokeLambda
  })

  return { handler, logger, invokeLambda }
}

experiment('DTS processing', () => {
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

  test('it should handle a 404 response and delete the station from the DB', async () => {
    const { handler } = setupHandlerWithStubs()
    setupAxiosStdStub(api404)
    const counter = setupStdDbStubs([{ rloi_id: 1001 }])
    await handler()
    expect(counter).to.equal({ begin: 1, commit: 1, del: 1, select: 1 })
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
    expect(logInfoCalls[0].args[0]).to.equal('Retrieving up to 500 rloi_ids with an offset of 0')
    expect(logInfoCalls[1].args[0]).to.equal('Retrieved 1 rloi_ids')
    expect(logInfoCalls[2].args[0]).to.equal('Processed displayTimeSeries for RLOI id 1001')
  })
  test('it should return empty object from getImtdApiResponse when API returns 404 for a given RLOI id', async () => {
    sinon.stub(axios, 'get').rejects({ response: { status: 404 } })

    const data = await getImtdApiResponse(1001)
    await expect(data).to.equal({})
  })
  test('it should return object from getImtdApiResponse when API successful returns data for a given RLOI id', async () => {
    setupAxiosStdStub()
    const data = await getImtdApiResponse(1001)
    await expect(data.status).to.equal(200)
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
    expect(logErrorCalls[0].args[0]).to.equal('Database error processing stationData')
    expect(logErrorCalls[1].args[0]).to.equal('Could not process data for station 1001 (delete from "station_display_time_series" where "station_id" = $1 - Delete Fail)')

    const logInfoCalls = logger.info.getCalls()
    expect(logInfoCalls.length).to.equal(2)
  })
  experiment('validateStationData', () => {
    let stationDataArray

    beforeEach(() => {
      stationDataArray = [
        {
          station_id: 1,
          direction: 'north',
          display_time_series: true
        },
        {
          station_id: 2,
          direction: 'south',
          display_time_series: false
        }
      ]
    })

    test('validates the station data successfully', async () => {
      const result = await validateStationData(stationDataArray)
      expect(result).to.equal(stationDataArray)
    })

    test('throws an error when station data is invalid', async () => {
      stationDataArray[0].station_id = 'invalid'
      try {
        await validateStationData(stationDataArray)
      } catch (err) {
        expect(err).to.exist()
        expect(err.message).to.equal('Validation error: "station_id" must be a number')
      }
    })
  })
})
