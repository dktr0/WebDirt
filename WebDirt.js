WebDirt = function() {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  try {
    this.ac = new AudioContext();
    console.log("WebDirt audio context created");
  }
  catch(e) {
    alert('Web Audio API is not supported in this browser');
  }
  this.sampleBank = new SampleBank('sampleMap.json','samples',this.ac);
}

WebDirt.prototype.queue = function(msg) {
	if(msg.when==null) throw Error ("Sample given no 'when' parameter");
	var graph = new Graph(msg,this.ac,this.sampleBank);
}

WebDirt.prototype.subscribeToTidalSocket = function(withLog) {
  if(withLog == null)withLog = false;
  window.WebSocket = window.WebSocket || window.MozWebSocket;
  var url = 'ws://127.0.0.1:7771'; // hard-coded to local server for now...
  console.log("attempting websocket connection to " + url);
  ws = new WebSocket(url);
  ws.onopen = function () { console.log("websocket connection to tidalSocket opened"); };
  ws.onerror = function () { console.log("ERROR opening websocket connection to tidalSocket"); };
  var closure = this;
  ws.onmessage = function (m) {
    if(m.data == null) throw Error("null data in tidalSocket onmessage handler");
    var msg = JSON.parse(m.data);
    if(msg.address == null) throw Error("received message from tidalSocket with no address: " + m.data);
    else if(msg.address != "/play") throw Error("address of message from tidalSocket wasn't /play: " + m.data);
    else if(msg.args.constructor !== Array) throw Error("ERROR: message from tidalSocket where args doesn't exist or isn't an array: " + m.data);
    else if(msg.args.length != 30) throw Error("ERROR: message from tidalSocket with " + msg.args.length + " args instead of 30: " + m.data);
    else {
      var x = {};
      var diff = Date.now()/1000 - closure.ac.currentTime;
      x.when = msg.args[0] + (msg.args[1]/1000000) - diff;
      x.sample_name = msg.args[3];
      x.sample_n = msg.args[29];
      x.speed = 1;
      closure.queue(x);
      if(withLog)console.log(msg);
    }
  };
}
