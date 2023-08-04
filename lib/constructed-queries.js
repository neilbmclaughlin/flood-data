const knex = require('knex')({ client: 'pg' })
const Query = require('./helpers/query')

module.exports = {
  slsTelemetryValues: values => {
    const knexQuery = knex('sls_telemetry_value').insert(values)
    return Query.fromKnexQuery(knexQuery)
  },
  slsTelemetryStation: values => {
    const sql = `
        INSERT INTO u_flood.sls_telemetry_station (station_reference, region, station_name, ngr, easting, northing)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT
            ON CONSTRAINT unique_station DO UPDATE SET station_name = EXCLUDED.station_name,
                                                       ngr          = EXCLUDED.ngr,
                                                       easting      = EXCLUDED.easting,
                                                       northing     = EXCLUDED.northing;
    `
    return Query.fromString(sql, values)
  },
  slsTelemetryValueParent: values => {
    const sql = `
        INSERT INTO sls_telemetry_value_parent(filename, imported, rloi_id, station, region, start_timestamp,
                                               end_timestamp, parameter, qualifier, units, post_process, subtract,
                                               por_max_value, station_type, percentile_5, data_type, period)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING telemetry_value_parent_id
    `
    return Query.fromString(sql, values)
  },
  deleteOldTelemetry: () => {
    const sql = `
        DELETE
        FROM u_flood.sls_telemetry_value_parent
        WHERE imported < to_timestamp(EXTRACT(EPOCH FROM now()) - 432000) at time zone 'utc';
    `
    return Query.fromString(sql)
  }
}
