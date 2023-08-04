const sinon = require('sinon')
const { expect } = require('@hapi/code')
const Lab = require('@hapi/lab')
const { afterEach, beforeEach, describe, it } = exports.lab = Lab.script()
const proxyquire = require('proxyquire')

describe('DatabasePool', () => {
  let poolStub
  let clientStub
  let Pool

  beforeEach(() => {
    clientStub = {
      query: sinon.stub().resolves({ /* mocked query result */ }),
      release: sinon.stub().resolves()
    }
    poolStub = {
      connect: sinon.stub().resolves(clientStub),
      end: sinon.stub().resolves()
    }
    Pool = proxyquire('../../../lib/helpers/pool', {
      pg: { Pool: sinon.stub().returns(poolStub) }
    }).Pool
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('query', () => {
    it('should execute query using client from the pool', async () => {
      // Arrange
      const pool = new Pool()
      const queryName = 'slsTelemetryStation'
      const values = [1, 2, 'test']

      // Act
      await pool.query(queryName, values)

      // Assert
      expect(poolStub.connect.calledOnce).to.be.true()
      expect(clientStub.query.calledOnceWithExactly({
        text: sinon.match(/INSERT/),
        values
      })).to.be.true()
      expect(clientStub.release.calledOnce).to.be.true()
      // array length should be 6 to match positional parameters
    })

    it('should execute knex query using client from the pool', async () => {
      // Arrange
      const pool = new Pool()
      const queryName = 'slsTelemetryValues'
      const values = [{ a: 1, b: 2, c: 'test' }]

      // Act
      await pool.query(queryName, values)

      // Assert
      expect(poolStub.connect.calledOnce).to.be.true()
      // console.log( clientStub.query.getCalls() )
      expect(clientStub.query.lastCall.args).to.equal([{
        text: 'insert into "sls_telemetry_value" ("a", "b", "c") values ($1, $2, $3)',
        values: [
          1, 2, 'test'
        ]
      }])
      expect(clientStub.release.calledOnce).to.be.true()
      // array length should be 6 to match positional parameters
    })

    it('should throw an error if query name is unknown', async () => {
      // Arrange
      const pool = new Pool()
      const queryName = 'nonExistentQuery'
      const values = { /* query values */ }

      // Act & Assert
      await expect(pool.query(queryName, values)).to.reject()
      expect(poolStub.connect.calledOnce).to.be.false()
      expect(clientStub.query.calledOnce).to.be.false()
      expect(clientStub.release.calledOnce).to.be.false()
    })
  })
  describe('end', () => {
    it('should gracefully end the connection pool', async () => {
      // Arrange
      const pool = new Pool()

      // Act
      await pool.end()

      // Assert
      expect(poolStub.end.calledOnce).to.be.true()
    })

    it('should throw an error if ending the pool fails', async () => {
      // Arrange
      const pool = new Pool()
      poolStub.end.rejects(new Error('Failed to end pool'))

      // Act & Assert
      await expect(pool.end()).to.reject()
      expect(poolStub.end.calledOnce).to.be.true()
    })
  })
})
