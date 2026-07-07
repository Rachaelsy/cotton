const assert = require('assert')
const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..', '..')

function readRootFile(...parts) {
  return fs.readFileSync(path.join(rootDir, ...parts), 'utf8')
}

function run() {
  const drawWxml = readRootFile('pages', 'fields', 'draw.wxml')
  const drawJs = readRootFile('pages', 'fields', 'draw.js')
  const drawWxss = readRootFile('pages', 'fields', 'draw.wxss')
  const i18n = readRootFile('utils', 'i18n.js')
  const appJson = JSON.parse(readRootFile('app.json'))

  assert.ok(drawWxml.includes('walk-track-card'), 'draw page should render a phone walking boundary card')
  assert.ok(drawWxml.includes('bindtap="onStartBoundaryTrack"'), 'draw page should expose a start walking action')
  assert.ok(drawWxml.includes('bindtap="onStopBoundaryTrack"'), 'draw page should expose a stop walking action')
  assert.ok(drawWxml.includes('trackDistance'), 'draw page should show collected walking distance')
  assert.ok(drawJs.includes('onStartBoundaryTrack'), 'draw page should implement start walking boundary tracking')
  assert.ok(drawJs.includes('wx.startLocationUpdate'), 'walking boundary tracking should start continuous location updates')
  assert.ok(drawJs.includes('wx.onLocationChange'), 'walking boundary tracking should listen for location changes')
  assert.ok(drawJs.includes('onStopBoundaryTrack'), 'draw page should implement stopping boundary tracking')
  assert.ok(drawJs.includes('wx.offLocationChange'), 'stopping tracking should detach the location listener')
  assert.ok(drawJs.includes('wx.stopLocationUpdate'), 'stopping tracking should stop continuous location updates')
  assert.ok(drawJs.includes('MIN_TRACK_POINT_DISTANCE'), 'tracking should filter tiny GPS jitter before adding points')
  assert.ok(drawJs.includes('_appendTrackPoint'), 'tracking should append valid GPS points through a dedicated method')
  assert.ok(drawJs.includes('_stopBoundaryTrack'), 'tracking cleanup should be reusable by clear/back/unload flows')
  assert.ok(drawWxss.includes('.walk-track-card'), 'draw styles should include the walking boundary card')
  assert.ok(i18n.includes('walkBoundary'), 'language copy should include walking boundary labels')
  assert.ok(i18n.includes('trackLocationFail'), 'language copy should include tracking failure text')
  assert.ok(
    appJson.requiredPrivateInfos && appJson.requiredPrivateInfos.includes('startLocationUpdate'),
    'app.json should declare startLocationUpdate for real-device continuous location tracking'
  )
}

run()
console.log('field walking boundary UI tests passed')
