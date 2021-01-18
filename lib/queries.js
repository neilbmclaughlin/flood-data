module.exports = {
  slsTelemetryStation: 'INSERT INTO u_flood.sls_telemetry_station (station_reference, region, station_name, ngr, easting, northing) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT ON CONSTRAINT unique_station DO UPDATE SET station_name = EXCLUDED.station_name,ngr = EXCLUDED.ngr,easting = EXCLUDED.easting,northing = EXCLUDED.northing;',
  slsTelemetryValueParent: 'INSERT INTO sls_telemetry_value_parent(filename, imported, rloi_id, station, region, start_timestamp, end_timestamp, parameter, qualifier, units, post_process, subtract, por_max_value, station_type, percentile_5, data_type, period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING telemetry_value_parent_id',
  deleteCurrentFwis: 'delete from u_flood.fwis;',
  refreshFloodWarningsMview: 'refresh materialized view u_flood.fwa_mview with data;',
  updateTimestamp: 'update u_flood.current_load_timestamp set load_timestamp = $1 where id = 1;',
  deleteStations: 'Truncate table u_flood.telemetry_context;',
  refreshStationMviews: 'REFRESH MATERIALIZED VIEW u_flood.telemetry_context_mview with data; REFRESH MATERIALIZED VIEW u_flood.station_split_mview with data; REFRESH MATERIALIZED VIEW u_flood.stations_overview_mview WITH DATA; REFRESH MATERIALIZED VIEW u_flood.impact_mview WITH DATA; REFRESH MATERIALIZED VIEW u_flood.rivers_mview WITH DATA; REFRESH MATERIALIZED VIEW u_flood.rainfall_stations_mview WITH DATA;',
  stationLoadTimestamp: 'INSERT INTO u_flood.current_load_timestamp VALUES (2, $1) on CONFLICT (ID) DO UPDATE SET load_timestamp = $1',
  deleteOldTelemetry: 'DELETE FROM u_flood.sls_telemetry_value_parent WHERE imported < to_timestamp(EXTRACT(EPOCH FROM now()) - 432000) at time zone \'utc\';',
  upsertFfoiMax: 'INSERT INTO u_flood.ffoi_max (telemetry_id, value, value_date, filename, updated_date) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (telemetry_id) DO UPDATE SET value = $2, value_date = $3, filename = $4, updated_date = $5',
  updateStationTa8km: 'select u_flood.station_ta_8km_update();'
}
