/**
 * @param {Object} data - The data to be parsed.
 * @returns {Object} - The processed data.
 */
function parseTimeSeries (data, stationId) {
  if (!data) {
    return {}
  }

  const processedData = data.map((item) => ({
    station_id: stationId,
    direction: item.qualifier === 'Downstream Stage' ? 'd' : 'u',
    display_time_series: item.DisplayTimeSeries
  }))

  const uniqueProcessedData = processedData.filter((item, index, self) =>
    index === self.findIndex((t) => (
      t.station_id === item.station_id && t.direction === item.direction
    ))
  )

  return uniqueProcessedData
}

module.exports = parseTimeSeries
