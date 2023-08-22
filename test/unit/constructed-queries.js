const { expect } = require('@hapi/code')
const Lab = require('@hapi/lab')
const { slsTelemetryValues, slsTelemetryStation, slsTelemetryValueParent, deleteOldTelemetry } = require('../../lib/constructed-queries')
const { describe, it } = exports.lab = Lab.script()

describe('constructedQueries', () => {
  describe('slsTelemetryValues', () => {
    it('returns appropriate sql with the values properly formatted in a query object', () => {
      // Arrange
      const values = [
        {
          telemetry_value_parent_id: 12345,
          value: 4.45,
          processed_value: 4.45,
          value_timestamp: new Date('2023-01-01T00:00:00Z'),
          error: false
        },
        {
          telemetry_value_parent_id: 12345,
          value: null,
          processed_value: null,
          value_timestamp: new Date('2023-01-01T01:00:00Z').toISOString(),
          error: true
        },
        {
          telemetry_value_parent_id: 12345,
          value: NaN,
          processed_value: NaN,
          value_timestamp: new Date('2023-01-01T02:00:00Z').toISOString(),
          error: false
        }
      ]

      // Act
      const actual = slsTelemetryValues(values)

      // Assert
      expect(actual.text).to.match(/insert into "sls_telemetry_value" \("error", "processed_value", "telemetry_value_parent_id", "value", "value_timestamp"\)/)
      expect(JSON.stringify(actual.values)).to.equal(JSON.stringify([
        false,
        4.45,
        12345,
        4.45,
        '2023-01-01T00:00:00.000Z',
        true,
        null,
        12345,
        null,
        '2023-01-01T01:00:00.000Z',
        false,
        NaN,
        12345,
        NaN,
        '2023-01-01T02:00:00.000Z'
      ]))
    })
  })

  describe('slsTelemetryStation', () => {
    it('returns appropriate sql with the values in a query object', () => {
      // Arrange
      const values = [1, 2, 3, 4, 5, 6]

      // Act
      const actual = slsTelemetryStation(values)

      // Assert
      expect(actual.text).to.match(/INSERT INTO u_flood.sls_telemetry_station/)
      expect(actual.values).to.equal(values)
    })
  })

  describe('slsTelemetryValueParent', () => {
    it('returns appropriate sql with the values in a query object', () => {
      // Arrange
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]

      // Act
      const actual = slsTelemetryValueParent(values)

      // Assert
      expect(actual.text).to.match(/INSERT INTO sls_telemetry_value_parent/)
      expect(actual.values).to.equal(values)
    })
  })

  describe('deleteOldTelemetry', () => {
    it('returns appropriate sql in a query object', () => {
      // Act
      const actual = deleteOldTelemetry()

      // Assert
      expect(actual.text).to.match(/DELETE\s* FROM u_flood.sls_telemetry_value_parent/)
      expect(actual.values).to.be.undefined()
    })
  })
})
