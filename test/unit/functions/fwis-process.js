const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const handler = require('../../../lib/functions/fwis-process').handler
const event = require('../../events/fwis-event.json')
const Fwis = require('../../../lib/models/fwis')
const wreck = require('../../../lib/helpers/wreck')

// start up Sinon sandbox
const sinon = require('sinon').createSandbox()

lab.experiment('fwis processing', () => {
  lab.beforeEach(() => {

  })
  lab.afterEach(() => {
    // restore sinon sandbox
    sinon.restore()
  })
  lab.test('fwis process', async () => {
    // setup mocks
    sinon.stub(wreck, 'request').callsFake(() => {
      return Promise.resolve({})
    })
    sinon.stub(Fwis.prototype, 'save').callsFake(() => {
      return Promise.resolve({})
    })
    await handler(event)
  })

  lab.test('fwis process S3 error', async () => {
    // setup mocks
    sinon.stub(wreck, 'request').callsFake(() => {
      return Promise.reject(new Error('test error'))
    })
    sinon.stub(Fwis.prototype, 'save').callsFake(() => {
      return Promise.resolve({})
    })
    await Code.expect(handler(event)).to.reject()
  })

  lab.test('fwis process fwis error', async () => {
    // setup mocks
    sinon.stub(wreck, 'request').callsFake(() => {
      return Promise.resolve({})
    })
    sinon.stub(Fwis.prototype, 'save').callsFake(() => {
      return Promise.reject(new Error('test error'))
    })
    await Code.expect(handler(event)).to.reject()
  })
})
