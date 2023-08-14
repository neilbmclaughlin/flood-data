const { expect } = require('@hapi/code')
const Lab = require('@hapi/lab')
const {
  slsTelemetryValues, slsTelemetryStation, slsTelemetryValueParent, deleteOldTelemetry, refreshStationMviews,
  deleteStations, insertStations, upsertFfoiMax, deleteCurrentFwis, insertFloodWarnings, refreshFloodWarningsMview,
  updateTimestamp
} = require('../../lib/constructed-queries')
const insertStationFixture = require('../data/insert-station.json')
const floodWarningFixture = require('../data/flood-warning.json')
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

  describe('refreshStationMviews', () => {
    it('returns appropriate sql in a query object', () => {
      // Act
      const actual = refreshStationMviews()

      // Assert
      for (const line of actual.text.trim().split('\n')) {
        expect(line.trim()).to.match(/^REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood\..* WITH DATA;$/)
      }
      expect(actual.values).to.be.undefined()
    })
  })

  describe('deleteStations', () => {
    it('returns appropriate sql in a query object', () => {
      // Act
      const actual = deleteStations()

      // Assert
      expect(actual.text).to.match(/TRUNCATE table u_flood.telemetry_context/)
      expect(actual.values).to.be.undefined()
    })
  })

  describe('insertStations', () => {
    it('returns appropriate sql with the values properly formatted in a query object', () => {
      // Arrange
      const values = [
        insertStationFixture,
        insertStationFixture,
        insertStationFixture
      ]

      // Act
      const actual = insertStations(values)

      // Assert
      expect(actual.text).to.match(/insert into "telemetry_context" \("actual_ngr", "agency_name", "area", "catchment", "comments", "d_comments", "d_date_highest_level", "d_date_por_max", "d_date_por_min", "d_highest_level", "d_percentile_5", "d_percentile_95", "d_period_of_record", "d_por_max_value", "d_por_min_value", "d_stage_datum", "date_highest_level", "date_open", "date_por_max", "date_por_min", "display_area", "display_catchment", "display_region", "external_name", "highest_level", "location_info", "percentile_5", "percentile_95", "period_of_record", "por_max_value", "por_min_value", "post_process", "region", "rloi_id", "site_max", "stage_datum", "station_type", "status", "status_date", "status_reason", "subtract", "telemetry_id", "wiski_id", "wiski_river_name", "x_coord_actual", "x_coord_display", "y_coord_actual", "y_coord_display"\)/)
      expect(actual.values).to.have.length(Object.values(insertStationFixture).length * 3)
    })
  })

  describe('upsertFfoiMax', () => {
    it('returns appropriate sql with the values in a query object', () => {
      // Arrange
      const values = [1, 2, 3, 4, 5]

      // Act
      const actual = upsertFfoiMax(values)

      // Assert
      expect(actual.text).to.match(/INSERT INTO u_flood.ffoi_max/)
      expect(actual.values).to.equal(values)
    })
  })

  describe('deleteCurrentFwis', () => {
    it('returns appropriate sql in a query object', () => {
      // Act
      const actual = deleteCurrentFwis()

      // Assert
      expect(actual.text).to.match(/DELETE\s* FROM u_flood.fwis/)
      expect(actual.values).to.be.undefined()
    })
  })

  describe('insertFloodWarnings', () => {
    it('returns appropriate sql with the values properly formatted in a query object', () => {
      // Arrange
      const values = [
        floodWarningFixture,
        floodWarningFixture,
        floodWarningFixture,
        floodWarningFixture
      ]

      // Act
      const actual = insertFloodWarnings(values)

      // Assert
      expect(actual.text).to.match(/insert into "fwis" \("message_received", "owner_area", "quick_dial", "severity", "severity_changed", "severity_value", "situation", "situation_changed", "ta_category", "ta_code", "ta_created_date", "ta_d", "ta_description", "ta_modified_date", "ta_name", "ta_version"\)/)
      expect(actual.values).to.have.length(Object.values(floodWarningFixture).length * 4)
    })
  })

  describe('refreshFloodWarningsMview', () => {
    it('returns appropriate sql in a query object', () => {
      // Act
      const actual = refreshFloodWarningsMview()

      // Assert
      expect(actual.text).to.match(/REFRESH MATERIALIZED VIEW u_flood.fwa_mview/)
      expect(actual.values).to.be.undefined()
    })
  })

  describe('updateTimestamp', () => {
    it('returns appropriate sql with the values in a query object', () => {
      // Arrange
      const values = [Math.floor(new Date('2012-04-22T00:00:00').getTime() / 1000)]

      // Act
      const actual = updateTimestamp(values)

      // Assert
      expect(actual.text).to.match(/UPDATE u_flood.current_load_timestamp/)
      expect(actual.values).to.equal(values)
    })
  })
})
