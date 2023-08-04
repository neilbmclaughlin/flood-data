module.exports = {
  deleteCurrentFwis: 'delete from u_flood.fwis;',
  refreshFloodWarningsMview: 'refresh materialized view u_flood.fwa_mview with data;',
  updateTimestamp: 'update u_flood.current_load_timestamp set load_timestamp = $1 where id = 1;',
  deleteStations: 'Truncate table u_flood.telemetry_context;',
  refreshStationMviews: 'REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.telemetry_context_mview with data; REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.station_split_mview with data; REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.stations_overview_mview WITH DATA; REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.impact_mview WITH DATA; REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.rivers_mview WITH DATA; REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.rainfall_stations_mview WITH DATA; REFRESH MATERIALIZED VIEW CONCURRENTLY u_flood.stations_list_mview WITH DATA;',
  stationLoadTimestamp: 'INSERT INTO u_flood.current_load_timestamp VALUES (2, $1) on CONFLICT (ID) DO UPDATE SET load_timestamp = $1',
  upsertFfoiMax: 'INSERT INTO u_flood.ffoi_max (telemetry_id, value, value_date, filename, updated_date) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (telemetry_id) DO UPDATE SET value = $2, value_date = $3, filename = $4, updated_date = $5',
  updateStationTa8km: 'select u_flood.station_ta_8km_update();'
}
