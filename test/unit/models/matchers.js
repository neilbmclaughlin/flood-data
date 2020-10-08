const {
  valuesSchemaQueryMatcher,
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
    const query = 'INSERT INTO sls_telemetry_value_parent(filename, imported, rloi_id, station, region, start_timestamp, end_timestamp, parameter, qualifier, units, post_process, subtract, por_max_value, station_type, percentile_5) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING telemetry_value_parent_id'
    Code.expect(valueParentSchemaQueryMatcher.test(query)).to.be.true()
  })
  lab.test('valueParentSchemaQueryMatcher should not match', async () => {
    const query = {
      text: 'INSERT INTO "sls_telemetry_value" ("telemetry_value_parent_id", "value", "processed_value", "value_timestamp", "error") VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15), ($16, $17, $18, $19, $20)',
      values: [1, 1.986, null, '2018-06-29T10:15:00.000Z', true, 1, 1.986, null, '2018-06-29T10:30:00.000Z', true, 1, 1.986, null, '2018-06-29T10:45:00.000Z', true, 1, 1.986, null, '2018-06-29T11:00:00.000Z', true]
    }
    Code.expect(valueParentSchemaQueryMatcher.test(query)).to.be.false()
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
  lab.experiment('valuesSchemaQueryMatcher', async () => {
    lab.test('insert into sls_telemetry_value should match', async () => {
      const query = {
        text: 'INSERT INTO "sls_telemetry_value" ("telemetry_value_parent_id", "value", "processed_value", "value_timestamp", "error") VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10), ($11, $12, $13, $14, $15), ($16, $17, $18, $19, $20)',
        values: [1, 1.986, null, '2018-06-29T10:15:00.000Z', true, 1, 1.986, null, '2018-06-29T10:30:00.000Z', true, 1, 1.986, null, '2018-06-29T10:45:00.000Z', true, 1, 1.986, null, '2018-06-29T11:00:00.000Z', true]
      }
      Code.expect(valuesSchemaQueryMatcher.test(query)).to.be.true()
    })
    lab.test('insert into sls_telemetry_value_parent should not match', async () => {
      const query = 'INSERT INTO sls_telemetry_value_parent(filename, imported, rloi_id, station, region, start_timestamp, end_timestamp, parameter, qualifier, units, post_process, subtract, por_max_value, station_type, percentile_5) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING telemetry_value_parent_id'
      Code.expect(valuesSchemaQueryMatcher.test(query)).to.be.false()
    })
    lab.test('empty query object should not match', async () => {
      const query = {}
      Code.expect(valuesSchemaQueryMatcher.test(query)).to.be.false()
    })
  })
})
