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

WebDirt.prototype.playScore = function(score) {
  // where score is an array of message objects (each of which fulfills same expectations as the method 'queue' above)
  var start = this.ac.currentTime + 0.25;
  for(let msg of score) {
    msg.when = msg.when + start;
    // begin: a temporary kludge
    msg.sample_name = msg.s;
    if(msg.n != null) msg.sample_n = msg.n;
    // end: a temporary kludge
    this.sampleBank.load(msg.sample_name,msg.sample_n); // make an early attempt to load samples, ahead of playback
    this.queue(msg);
  }
}

WebDirt.prototype.loadAndPlayScore = function(url) {
  var request = new XMLHttpRequest();
  request.open('GET',url,true);
  request.responseType = "json";
  var closure = this;
  request.onload = function() {
    if(request.readyState != 4) throw Error("readyState != 4 in callback of loadAndPlayScore");
    if(request.status != 200) throw Error("status != 200 in callback of loadAndPlayScore");
    if(request.response == null) throw Error("JSON response null in callback of loadAndPlayScore");
    console.log("playing JSON score from " + url);
    closure.playScore(request.response);
  }
  request.send();
}

WebDirt.prototype.subscribeToTidalSocket = function(url,withLog) {
  if(withLog == null)withLog = false;
  window.WebSocket = window.WebSocket || window.MozWebSocket;
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
      //4 not used.
      x.begin = msg.args[5];
      x.end = msg.args[6];
      x.speed = msg.args[7];
      x.pan = msg.args[8];
      //9 not used.
      x.vowel=msg.args[10];
      x.cutoff = msg.args[11];
      x.resonance = msg.args[12];
      x.accelerate = msg.args[13];
      x.shape = msg.args[14];
      //15 not used.
      x.gain = msg.args[16]
      x.cut = msg.args[17];
      x.delay = msg.args[18];
      x.delaytime = msg.args[19];
      x.delayfeedback = msg.args[20]
      x.crush = msg.args[21];
      x.coarse = msg.args[22];
      x.hcutoff = msg.args[23];
      x.hresonance = msg.args[24];
      x.bandf = msg.args[25];
      x.bandq = msg.args[26];
      x.unit_name = msg.args[27];
      x.sample_loop = msg.args[28];
      x.sample_n = msg.args[29];


      closure.queue(x);
      if(withLog)console.log(msg);
    }
  };
}
