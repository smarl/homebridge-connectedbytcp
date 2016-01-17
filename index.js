var request = require("request"),
    uuid = require("node-uuid"),
    xml2js = require('xml2js'),
    Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  
  homebridge.registerAccessory("homebridge-conntectedbytcp", "ConnectedByTcp", ConnectedByTcp);
}

function ConnectedByTcp(log, config) {
  this.log        = log;
  this.name       = config["name"];
  this.ip         = config["ip"];
  this.token      = config["token"];
  
  if(this.token === undefined) {
    this.log("Password not in config, attempting to sync hub: [" + this.ip + "]");
    this.syncHub();
  } else {
    // Search the network for TCP Bulbs
    this.search();
  }
}

ConnectedByTcp.prototype.syncHub = function() {
  // /gwr/gop.php?cmd=GWRLogin&data=<gip><version>1</version><email>[myuuid]</email><password>[myuuid]</password></gip>&fmt=xml
  var self = this,
      loginAddress = "https://" + this.ip + "/gwr/gop.php",
      loginUid = uuid.v4(),
      cmd="GWRLogin",
      data=encodeURIComponent("<gip><version>1</version><email>"+loginUid+"</email><password>"+loginUid+"</password></gip>"),
      fmt="xml";

  request({
    "rejectUnauthorized": false,
    "url": loginAddress,
    "method": "POST",
    headers: {
      'Content-Type': 'text/xml'
    },
    body: "cmd=" + cmd + "&data=" + data + "&fmt=xml"
  }, function(error, response, body) {
    if (error && error.code == "ECONNREFUSED") {
      self.log("Unabled to connect to IP, is this the right IP address for your hub?");
    } else if (error) {
      self.log("error.code: " + error.code);
      self.log("error.errno: " + error.errno);
      self.log("error.syscall: " + error.syscall);
    } else if(body == "<gip><version>1</version><rc>404</rc></gip>") {
      self.log("Hub is not in sync mode, set to sync mode an try again.");
    } else if(body.match(/.*<token>(.*)<\/token>.*/) !== null) {
      // Token Matches
      // <gip><version>1</version><rc>200</rc><token>e2de937chr0lhrlqd6bus3l2z5jcy5p3vs7013bn</token></gip>
      self.token = body.replace(/.*<token>(.*)<\/token>.*/,"$1");
      self.log("Hub is synced, update your config.json to include:");
      self.log("  token: " + self.token);
    } else {
      self.log("error: " + error);
      self.log("response: " + response);
      self.log("body: " + body);
    }
  });
  
}

ConnectedByTcp.prototype.search = function() {
  var self = this,
      loginAddress = "https://" + self.ip + "/gwr/gop.php",
      cmd="RoomGetCarousel",
      data=encodeURIComponent("<gip><version>1</version><token>" + self.token + "</token><fields>name\ncontrol\npower\nproduct\nclass\nrealtype\nstatus</fields></gip>"),
      fmt="xml";

  request({
    "rejectUnauthorized": false,
    "url": loginAddress,
    "method": "POST",
    headers: {
      'Content-Type': 'text/xml'
    },
    body: "cmd=" + cmd + "&data=" + data + "&fmt=xml"
  }, function(error, response, body) {
    if (error && error.code == "ECONNREFUSED") {
      self.log("Unabled to connect to IP, is this the right IP address for your hub?");
    } else if (error) {
      self.log("error.code: " + error.code);
      self.log("error.errno: " + error.errno);
      self.log("error.syscall: " + error.syscall);
    } else if(body == "<gip><version>1</version><rc>404</rc></gip>") {
      self.log("Hub is not in sync mode, set to sync mode an try again.");
    } else {
      self.log("Parsing XML");
      xml2js.parseString(body, function (err, result) {
        self.log("Done parsing XML: " + JSON.stringify());
        // For each room for each device, get the did, state, level, and store it.
        for (var i = 0; i < result.gip.room.length; i++) {
          self.log("Cycling rooms: " + JSON.stringify(result.gip.room[i]));
          for (var j = 0; j < result.gip.room[i].device.length; j++) {
            self.log("deviceid: " + result.gip.room[i].device[j].did);
            self.log("state: " + result.gip.room[i].device[j].state);
            self.log("level: " + result.gip.room[i].device[j].level);
          }
        }
      });

      self.log("error: " + error);
      self.log("response: " + response);
      self.log("body: " + body);
    }
  });

}

ConnectedByTcp.prototype.getServices = function() {
  // This will be returning: Service.Lightbulb
  return [];
}