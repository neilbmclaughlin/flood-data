const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

const mocks = {
  invokeAsync: sinon.stub()
}

const invokeLambda = proxyquire('../../../lib/helpers/invoke-lambda', {
  'aws-sdk': {
    Lambda: function Lambda () {
      this.invokeAsync = mocks.invokeAsync
    }
  }
})

lab.experiment('invokeLambda', () => {
  lab.test('it invokesAsync the function passing the payload as its InvokeArgs', () => {
    mocks.invokeAsync.returns({ promise: async () => {} })

    invokeLambda('some-function', { foo: 'bar' })

    Code.expect(mocks.invokeAsync.getCalls().length).to.equal(1)
    Code.expect(mocks.invokeAsync.getCalls()[0].args).to.equal([{
      FunctionName: 'some-function',
      InvokeArgs: '{"foo":"bar"}'
    }])
  })
})
