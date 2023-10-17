const sinon = require('sinon')
const { expect } = require('@hapi/code')
const Lab = require('@hapi/lab')
const { afterEach, beforeEach, describe, it } = exports.lab = Lab.script()
const proxyquire = require('proxyquire')

const mockConstructedQueries = {
  exampleQuery: (values) => {
    return {
      text: 'INSERT into "some_table" ("a", "b", "c") values ($1, $2, $3)', values
    }
  }
}

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
      pg: { Pool: sinon.stub().returns(poolStub) },
      '../constructed-queries': mockConstructedQueries
    }).Pool
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('query', () => {
    it('should execute a constructed query using client from the pool', async () => {
      // Arrange
      const pool = new Pool()
      const queryName = 'exampleQuery'
      const values = [
        1, 2, 'test'
      ]

      // Act
      await pool.query(queryName, values)

      // Assert
      expect(poolStub.connect.calledOnce).to.be.true()
      expect(clientStub.query.lastCall.args).to.equal([{
        text: 'INSERT into "some_table" ("a", "b", "c") values ($1, $2, $3)',
        values: [
          1, 2, 'test'
        ]
      }])
      expect(clientStub.release.calledOnce).to.be.true()
    })

    it('should throw an error if asked to execute an unknown query', async () => {
      // Arrange
      const pool = new Pool()
      const queryName = 'unknownQuery'
      const values = [
        1, 2, 'test'
      ]

      // Act
      let error
      try {
        await pool.query(queryName, values)
      } catch (e) {
        error = e
      }

      // Assert
      expect(poolStub.connect.calledOnce).to.be.false()
      expect(clientStub.query.called).to.be.false()
      expect(error).to.be.instanceof(Error)
      expect(error.message).to.equal('Query not found \'unknownQuery\'')
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
