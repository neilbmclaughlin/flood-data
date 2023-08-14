const util = require('../helpers/util')

module.exports = {
  async saveToObjects (stations, bucket, s3) {
    const params = {
      Body: JSON.stringify(stations),
      Bucket: bucket,
      Key: 'rloi/stations.json'
    }
    await s3.putObject(params)
    console.log(`${params.Key} uploaded`)
    const count = stations.length
    let uploaded = 0

    console.log(`${count} stations to load`)

    await Promise.all(stations.map(async station => {
      uploaded++
      try {
        await s3.putObject({
          Body: JSON.stringify(station),
          Bucket: bucket,
          Key: `rloi/${station.Region}/${station.Telemetry_ID}/station.json`
        })
      } catch (err) {
        console.log(`Failed to upload(${uploaded}/${count}): ${params.Key}`)
        console.error(err)
      }
    }))
    console.log('Stations processed')
  },

  async saveToDb (stations, pool) {
    const dbStations = stations.map(station => ({
      telemetry_id: station.Telemetry_ID,
      wiski_id: station.WISKI_ID,
      station_type: station.Station_Type,
      post_process: station.Post_Process,
      region: station.Region,
      area: station.Area,
      catchment: station.Catchment,
      display_region: station.Display_Region,
      display_area: station.Display_Area,
      display_catchment: station.Display_Catchment,
      agency_name: station.Agency_Name,
      external_name: station.External_Name,
      location_info: station.Location_Info,
      actual_ngr: station.Actual_NGR,
      comments: station.Comments,
      d_comments: station.D_Comments,
      d_period_of_record: station.D_Period_of_Record,
      status: station.Status,
      status_reason: station.Status_Reason,
      period_of_record: station.Period_of_Record,
      wiski_river_name: station.Wiski_River_Name,
      rloi_id: util.parseIntNull(station.RLOI_ID, 10),
      subtract: util.parseFloatNull(station.Subtract),
      x_coord_actual: util.parseIntNull(station.X_coord_Actual, 10),
      y_coord_actual: util.parseIntNull(station.Y_Coord_Actual, 10),
      x_coord_display: util.parseIntNull(station.X_coord_Display, 10),
      y_coord_display: util.parseIntNull(station.Y_coord_Display, 10),
      site_max: util.parseFloatNull(station.Site_Max),
      stage_datum: util.parseFloatNull(station.Stage_Datum),
      por_max_value: util.parseFloatNull(station.POR_Max_Value),
      highest_level: util.parseFloatNull(station.Highest_Level),
      por_min_value: util.parseFloatNull(station.POR_Min_Value),
      percentile_5: util.parseFloatNull(station.percentile_5),
      percentile_95: util.parseFloatNull(station.percentile_95),
      d_stage_datum: util.parseFloatNull(station.D_Stage_Datum),
      d_por_max_value: util.parseFloatNull(station.D_POR_Max_Value),
      d_highest_level: util.parseFloatNull(station.D_Highest_Level),
      d_percentile_5: util.parseFloatNull(station.D_percentile_5),
      d_percentile_95: util.parseFloatNull(station.D_percentile_95),
      d_por_min_value: util.parseFloatNull(station.D_POR_Min_Value),
      d_date_por_min: util.toUtcDateStringOrNull(station.D_Date_POR_Min),
      d_date_por_max: util.toUtcDateStringOrNull(station.D_Date_POR_Max),
      d_date_highest_level: util.toUtcDateStringOrNull(station.D_Date_Highest_Level),
      date_open: util.toUtcDateStringOrNull(station.Date_Open),
      date_por_min: util.toUtcDateStringOrNull(station.Date_POR_Min),
      date_por_max: util.toUtcDateStringOrNull(station.Date_POR_Max),
      date_highest_level: util.toUtcDateStringOrNull(station.Date_Highest_Level),
      status_date: util.toUtcDateStringOrNull(station.Status_Date)
    }))

    // Clear out stations
    await pool.query('deleteStations')

    // batch up the database inserts as struggles with > 1500 records
    const stationsFactor = Math.floor(dbStations.length / 500)
    for (let i = 0; i <= stationsFactor; i++) {
      const batch = dbStations.slice(i * 500, (i * 500) + 500)
      await pool.query('insertStations', batch)
    }

    // refresh mviews data
    await this.refreshStationMview(pool)
  },

  async refreshStationMview (pool) {
    await pool.query('refreshStationMviews')
  }
}
