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
  },
  refreshStationMviews: () => {
    const sql = `
        REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.telemetry_context_mview WITH DATA; 
        REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.station_split_mview WITH DATA; 
        REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.stations_overview_mview WITH DATA; 
        REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.impact_mview WITH DATA; 
        REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.rivers_mview WITH DATA; 
        REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.rainfall_stations_mview WITH DATA; 
        REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.stations_list_mview WITH DATA;
    `
    return Query.fromString(sql)
  },
  deleteStations: () => {
    const sql = `
        Truncate table u_flood.telemetry_context;
    `
    return Query.fromString(sql)
  },
  insertStations: values => {
    const knexQuery = knex('telemetry_context').insert(values)
    return Query.fromKnexQuery(knexQuery)
  },
  upsertFfoiMax: values => {
    const sql = `
        INSERT INTO u_flood.ffoi_max (telemetry_id, value, value_date, filename, updated_date)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (telemetry_id) DO UPDATE SET value        = $2,
                                                 value_date   = $3,
                                                 filename     = $4,
                                                 updated_date = $5
    `
    return Query.fromString(sql, values)
  }
}
