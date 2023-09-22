const { expect } = require('@hapi/code')
const Lab = require('@hapi/lab')
const { experiment, test } = (exports.lab = Lab.script())
const response = require('./data/imfs-simple-response.json')
const flowResponse = require('./data/imfs-flow-response.json')
const parseThresholds = require('../../../lib/models/parse-thresholds')

function clone (doc) {
  return JSON.parse(JSON.stringify(doc))
}

experiment('parseThresholds tests', () => {
  test('should parse thresholds from simple IMTD response', () => {
    const thresholds = parseThresholds(response[0].TimeSeriesMetaData)
    expect(thresholds).to.be.an.array()
    expect(thresholds.length).to.equal(3)
    expect(thresholds).to.equal([
      {
        floodWarningArea: '033WAF309',
        floodWarningType: 'A',
        direction: 'd',
        level: 1.3,
        thresholdType: 'FW RES FAL'
      },
      {
        floodWarningArea: '033FWF3TRENT04',
        floodWarningType: 'W',
        direction: 'd',
        level: 1.37,
        thresholdType: 'FW ACTCON FW'
      },
      {
        floodWarningArea: '033FWF3TRENT04',
        floodWarningType: 'W',
        direction: 'd',
        level: 1.77,
        thresholdType: 'FW RES FW'
      }
    ])
  })
  test('should parse thresholds from flow response', () => {
    const thresholds = parseThresholds(flowResponse[0].TimeSeriesMetaData)
    expect(thresholds).to.be.an.array()
    expect(thresholds.length).to.equal(16)
    // use the map to make the test more concise, consider whether this is better approach than in than test above
    expect(thresholds.map(t => `2116,${t.floodWarningArea},${t.floodWarningType},${t.direction},${t.level}`)).to.equal([
      '2116,034WAF414,A,u,1.7',
      '2116,034WAF415,A,u,2.4',
      '2116,034WAF414,A,u,2.6',
      '2116,034WAF415,A,u,2.7',
      '2116,034FWFTRCAVBRDG,W,u,2.7',
      '2116,034FWFTRSWARKST,W,u,2.8',
      '2116,034FWFTRBARROW,W,u,2.95',
      '2116,034FWFTRCASDONKM,W,u,2.95',
      '2116,034FWFTRRPTING,W,u,2.95',
      '2116,034FWFTRTRENTLK,W,u,3.1',
      '2116,034FWFTRTHRMPTN,W,u,3.15',
      '2116,034FWFTRTWYFORD,W,u,3.15',
      '2116,034FWFTRSHARDLW,W,u,3.45',
      '2116,034FWFTRWLLNGTN,W,u,3.45',
      '2116,034FWFTRNEWSAWLY,W,u,3.5',
      '2116,034FWFTRSAWLEY,W,u,3.5'
    ])
  })

  test('should parse thresholds where there are no thresholds returned', () => {
    const responseCopy = clone(response)
    responseCopy[0].TimeSeriesMetaData[0].Thresholds = []
    const thresholds = parseThresholds(responseCopy[0].TimeSeriesMetaData)
    expect(thresholds).to.be.an.array()
    expect(thresholds.length).to.equal(0)
  })
  test('should parse thresholds where the response has an empty TimeSeriesMetaData', () => {
    const responseCopy = clone(response)
    responseCopy[0].TimeSeriesMetaData = []
    const thresholds = parseThresholds(responseCopy[0].TimeSeriesMetaData)
    expect(thresholds).to.be.an.array()
    expect(thresholds.length).to.equal(0)
  })
  test('should parse thresholds where the response has no TimeSeriesMetaData', () => {
    const responseCopy = clone(response)
    delete responseCopy[0].TimeSeriesMetaData
    const thresholds = parseThresholds(responseCopy[0].TimeSeriesMetaData)
    expect(thresholds).to.be.an.array()
    expect(thresholds.length).to.equal(0)
  })
})
