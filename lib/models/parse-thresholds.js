const includedThresholdTypes = [
  'FW ACT FW',
  'FW ACTCON FW',
  'FW RES FW',
  'FW ACT FAL',
  'FW ACTCON FAL',
  'FW RES FAL'
]

function parseThresholds (data) {
  if (!data) {
    return []
  }

  return data
    .filter(({ Parameter }) => Parameter !== 'Flow')
    .flatMap(({ Thresholds, qualifier }) => {
      return Thresholds
        .filter(({ ThresholdType }) => includedThresholdTypes.includes(ThresholdType))
        .map(({ FloodWarningArea, Level }) => ({
          floodWarningArea: FloodWarningArea,
          floodWarningType: FloodWarningArea[4],
          direction: qualifier === 'Downstream Stage' ? 'd' : 'u',
          level: Level
        }))
    })
}

module.exports = parseThresholds
