const sinon = require('sinon')
const rloiValueParentSchema = require('./rloi-value-parent')
const rloiValuesSchema = require('./rloi-values')

const valueParentSchemaQueryMatcher = sinon.match((matchValue) => {
  return rloiValueParentSchema.query.validate(matchValue).error === undefined
}, 'parent query does not match expected schema')

const valueParentSchemaVarsMatcher = sinon.match((matchValue) => {
  return rloiValueParentSchema.vars.validate(matchValue).error === undefined
}, 'parent vars does not match expected schema')

const valuesSchemaQueryMatcher = sinon.match((matchValue) => {
  return rloiValuesSchema.query.validate(matchValue).error === undefined
}, 'Values query does not match expected schema')

module.exports = {
  valueParentSchemaQueryMatcher,
  valueParentSchemaVarsMatcher,
  valuesSchemaQueryMatcher
}
