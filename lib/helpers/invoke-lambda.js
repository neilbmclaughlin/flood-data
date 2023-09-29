const { Lambda } = require('aws-sdk')

const lambda = new Lambda()

module.exports = function invokeLambda (functionName, payload) {
  return lambda.invokeAsync({
    FunctionName: functionName,
    InvokeArgs: JSON.stringify(payload, null, 2)
  }).promise()
}
