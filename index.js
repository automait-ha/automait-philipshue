module.exports = init

var async = require('async')
  , Hue = require('node-hue-api')
  , HueApi = Hue.HueApi
  , lightState = Hue.lightState

function init(callback) {
  callback(null, 'hue', PhilipsHue)
}

function PhilipsHue(automait, logger, config) {
  this.automait = automait
  this.logger = logger
  this.config = config
  this.groups = config.groups
  this.api = new HueApi(config.bridgeIp, config.username)
}

PhilipsHue.prototype.areLightsOn = function (groupName, callback) {
  var lights = this.groups[groupName]
  if (!lights) return callback(new Error('No light group with name:' + groupName))

  var isOn = false
  async.each(lights
  , function (lightId, eachCb) {
      this.api.lightStatus(lightId, function (error, response) {
        if (error) return eachCb(error)
        isOn = response.state.on
        eachCb()
      })
    }.bind(this)
  , function (error) {
      if (error) return callback(error)
      callback(null, isOn)
    }
  )
}

PhilipsHue.prototype.setState = function (groupName, powerState, brightness, color, callback) {
  var lights = this.groups[groupName]
  if (!lights) return callback(new Error('No light group with name:' + groupName))

  var state = lightState.create()
  if (powerState) {
    state.on()
    if (color === 'white') {
      state.white(154, brightness)
    } else {
      state.brightness(brightness).rgb(color)
    }
  } else {
    state.off()
  }

  async.each(lights
  , function (lightId, eachCb) {
      this.api.setLightState(lightId, state, eachCb)
    }.bind(this)
  , callback
  )
}

PhilipsHue.prototype.flashColour = function (groupName, color, callback) {
  var lights = this.groups[groupName]
  if (!lights) return callback(new Error('No light group with name:' + groupName))

  var originalStates = {}
    , alertState = lightState.create().on().brightness(100).rgb(color).shortAlert()

  function getOriginalStates(cb) {
    async.each(lights
    , function (lightId, eachCb) {
        this.api.lightStatus(lightId, function (error, response) {
          if (error) return cb(error)
          var state = response.state
          state.alert = 'none'
          originalStates[lightId] = state
          eachCb()
        })
      }.bind(this)
    , cb
    )
  }

  function setAlertStates(cb) {
    async.each(lights
    , function (lightId, eachCb) {
        this.api.setLightState(lightId, alertState, eachCb)
      }.bind(this)
    , cb
    )
  }

  function setOriginalStates(cb) {
    async.each(lights
    , function (lightId, eachCb) {
        var state = originalStates[lightId]
        this.api.setLightState(lightId, state, eachCb)
      }.bind(this)
    , cb
    )
  }

  var tasks =
    [ getOriginalStates.bind(this)
    , setAlertStates.bind(this)
    ]

  async.series(tasks, function (error) {
    if (error) return callback(error)
    setTimeout(setOriginalStates.bind(this, callback), 1500)
  }.bind(this))
}
