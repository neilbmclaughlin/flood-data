const stations = [
  {
    rloi_id: 1001
  },
  {
    rloi_id: 1006
  },
  {
    rloi_id: 1009
  },
  {
    rloi_id: 1010
  },
  {
    rloi_id: 1011
  },
  {
    rloi_id: 1013
  },
  {
    rloi_id: 1014
  },
  {
    rloi_id: 1017
  }
]

const apiResponse = {
  status: 200,
  statusText: 'OK',
  data: [
    {
      RLOIid: '1165',
      wiskiID: '254290001',
      telemetryID: 'E10023',
      Name: 'Tanbridge GS',
      TimeSeriesMetaData: [
        {
          Parameter: 'Level',
          qualifier: 'Stage',
          Unit: 'mAOD',
          DisplayTimeSeries: false,
          Thresholds: [
            {
              ThresholdType: 'INFO RLOI PORMIN',
              Level: 32.114,
              FloodWarningArea: null
            },
            {
              ThresholdType: 'INFO RLOI PERCENT95',
              Level: 32.15,
              FloodWarningArea: null
            },
            {
              ThresholdType: 'INFO RLOI OTH',
              Level: 32.6,
              FloodWarningArea: null
            },
            {
              ThresholdType: 'FW ACTCON FAL',
              Level: 33.4,
              FloodWarningArea: '065WAF423'
            },
            {
              ThresholdType: 'FW ACTCON FAL',
              Level: 33.9,
              FloodWarningArea: '065WAF423'
            },
            {
              ThresholdType: 'FW RES FAL',
              Level: 34.2,
              FloodWarningArea: '065WAF423'
            },
            {
              ThresholdType: 'FW ACTCON FW',
              Level: 34.4,
              FloodWarningArea: '065FWF5001'
            },
            {
              ThresholdType: 'FW ACT FW',
              Level: 34.9,
              FloodWarningArea: '065FWF5001'
            },
            {
              ThresholdType: 'INFO RLOI PORMAX',
              Level: 34.956,
              FloodWarningArea: null
            },
            {
              ThresholdType: 'FW RES FW',
              Level: 35.2,
              FloodWarningArea: '065FWF5001'
            }
          ]
        }
      ]
    }
  ]
}

const apiNoMatchingThresholdResponse = {
  status: 200,
  statusText: 'OK',
  data: [
    {
      RLOIid: '1165',
      wiskiID: '254290001',
      telemetryID: 'E10023',
      Name: 'Tanbridge GS',
      TimeSeriesMetaData: [
        {
          Parameter: 'Level',
          qualifier: 'Stage',
          Unit: 'mAOD',
          DisplayTimeSeries: false,
          Thresholds: [
            {
              ThresholdType: 'INFO RLOI PORMIN',
              Level: 32.114,
              FloodWarningArea: null
            },
            {
              ThresholdType: 'INFO RLOI PERCENT95',
              Level: 32.15,
              FloodWarningArea: null
            },
            {
              ThresholdType: 'INFO RLOI OTH',
              Level: 32.6,
              FloodWarningArea: null
            }
          ]
        }
      ]
    }
  ]
}

const api404 = {
  type: 'https://tools.ietf.org/html/rfc7231#section-6.5.4',
  title: 'Not Found',
  status: 404,
  traceId: '0HN38TFTTO070:00000003'
}

const flattenedData = [
  { stationId: 9521, floodWarningArea: '113FWFEXE04', floodWarningType: 'W', direction: 'u', level: 2.4 },
  { stationId: 9521, floodWarningArea: '113FWFEXE03', floodWarningType: 'W', direction: 'u', level: 2.5 },
  { stationId: 9521, floodWarningArea: '113FWFEXE04', floodWarningType: 'W', direction: 'u', level: 2.7 },
  { stationId: 9521, floodWarningArea: '113FWFEXE06', floodWarningType: 'W', direction: 'u', level: 2.9 },
  { stationId: 9521, floodWarningArea: '113FWFEXE05', floodWarningType: 'W', direction: 'u', level: 3.6 },
  { stationId: 9524, floodWarningArea: '121WAF910', floodWarningType: 'A', direction: 'u', level: 0.95 },
  { stationId: 9524, floodWarningArea: '121FWF214', floodWarningType: 'W', direction: 'u', level: 1.2 },
  { stationId: 9524, floodWarningArea: '121FWF214', floodWarningType: 'W', direction: 'u', level: 1.7 },
  { stationId: 9525, floodWarningArea: '121WAF918', floodWarningType: 'A', direction: 'u', level: 0.7 },
  { stationId: 9525, floodWarningArea: '121FWF121', floodWarningType: 'W', direction: 'u', level: 0.7 },
  { stationId: 9525, floodWarningArea: '121FWF121', floodWarningType: 'W', direction: 'u', level: 1.25 }
]

module.exports = { stations, apiResponse, apiNoMatchingThresholdResponse, flattenedData, api404 }
