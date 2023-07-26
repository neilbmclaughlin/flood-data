const {
  valuesSchemaQueryMatcher,
  valuesSchemaVarsMatcher,
  valueParentSchemaQueryMatcher,
  valueParentSchemaVarsMatcher
} = require('../../schemas/matchers')
const Lab = require('@hapi/lab')
const lab = exports.lab = Lab.script()
const Code = require('@hapi/code')

lab.experiment('matchers', () => {
  // Note: these tests are testing code used in the rloi.js unit tests to match and assert on args
  // passed to db.query()
  lab.test('valueParentSchemaQueryMatcher should match', async () => {
    const queryName = 'slsTelemetryValueParent'
    Code.expect(valueParentSchemaQueryMatcher.test(queryName)).to.be.true()
  })

  lab.test('valueParentSchemaQueryMatcher should not match', async () => {
    const queryName = 'blah'
    Code.expect(valueParentSchemaQueryMatcher.test(queryName)).to.be.false()
  })

  lab.test('valueParentSchemaVarMatcher', async () => {
    const vars = [
      'testkey',
      'Tue Sep 15 2020 08:37:13 GMT+0100 (British Summer Time)',
      5075,
      'test1',
      'North West',
      'Fri Jun 29 2018 11:15:00 GMT+0100 (British Summer Time)',
      'Fri Jun 29 2018 12:00:00 GMT+0100 (British Summer Time)',
      'Water Level',
      'Stage',
      'm',
      true,
      2,
      3.428,
      'S',
      1.6
    ]
    Code.expect(valueParentSchemaVarsMatcher.test(vars)).to.be.true()
  })

  lab.test('valueParentSchemaVarMatcher', async () => {
    Code.expect(valueParentSchemaVarsMatcher.test(undefined)).to.be.false()
  })

  lab.test('insert values into sls_telemetry_value should match', async () => {
    const values = [
      {
        telemetry_value_parent_id: 1,
        value: 1.986,
        processed_value: -0.014,
        value_timestamp: '2018-06-29T11:00:00.000Z',
        error: false
      }
    ]
    Code.expect(valuesSchemaVarsMatcher.test(values)).to.be.true()
  })

  lab.test('insert into sls_telemetry_value should match', async () => {
    const queryName = 'slsTelemetryValues'
    Code.expect(valuesSchemaQueryMatcher.test(queryName)).to.be.true()
  })

  lab.test('insert into sls_telemetry_value_parent should not match', async () => {
    const query = 'blah'
    Code.expect(valuesSchemaQueryMatcher.test(query)).to.be.false()
  })

  lab.test('empty query object should not match', async () => {
    const query = {}
    Code.expect(valuesSchemaQueryMatcher.test(query)).to.be.false()
  })
})
