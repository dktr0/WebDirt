WebDirt = function(sampleMapUrl,sampleFolder,latency,callbackWhenReady) {
  if(sampleMapUrl == null) sampleMapUrl = "sampleMap.json";
  if(sampleFolder == null) sampleFolder = "samples";
  if(latency == null) latency = 0.2;
  this.latency = latency;
  this.sampleMapUrl = sampleMapUrl;
  this.sampleFolder = sampleFolder;
  this.sampleBank = new SampleBank(this.sampleMapUrl,this.sampleFolder,callbackWhenReady);
}

// note: the constructor above does not initialize the Web Audio context.
// this is deliberate in order to support the way things work on iOS, where
// the audio context must be initialized in response to a user interaction.
// each of the methods below the next method (queue, playScore, playScoreWhenReady,
// loadAndPlayScore,subscribeToTidalSocket) call initializeWebAudio (which has
// been written to only allow itself to run once) so it is _not_ expected that you call
// initializeWebAudio yourself. However, for things to work on iOS, you should
// make sure that that initializeWebAudio is called from a user interaction
// before any other potential calls to initializeWebAudio.

WebDirt.prototype.initializeWebAudio = function() {
  if(this.ac != null) return;
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  try {
    this.ac = new AudioContext();
    this.clockDiff = Date.now()/1000 - this.ac.currentTime;
    this.sampleBank.ac = this.ac;
    console.log("WebDirt audio context created");
  }
  catch(e) {
    alert('Web Audio API is not supported in this browser');
  }
}

WebDirt.prototype.queue = function(msg,latency) {
  this.initializeWebAudio();
  if(latency == null) latency = this.latency;
	if(msg.when==null) msg.when = this.ac.currentTime; // a sample without a 'when' is played 'now'(+latency)
  msg.when = msg.when + latency;
  if(msg.when < this.ac.currentTime) {
    console.log("WebDirt warning: msg late by " + (this.ac.currentTime-msg.when) + " seconds" );
  }
  var graph = new Graph(msg,this.ac,this.sampleBank);
}

WebDirt.prototype.playScore = function(score,latency) {
  // where score is an array of message objects (each of which fulfills same expectations as the method 'queue' above)
  // if no second argument (latency) is given, then latency defaults to latency default of this WebDirt instance
  this.initializeWebAudio();
  if(latency == null) latency = this.latency;
  var start = this.ac.currentTime;
  for(var i in score) {
    var msg = score[i];
    msg.when = msg.when + start;
    // begin: a temporary kludge
    if(msg.s != null) msg.sample_name = msg.s;
    if(msg.n != null) msg.sample_n = msg.n;
    // end: a temporary kludge
    this.sampleBank.load(msg.sample_name,msg.sample_n); // make an early attempt to load samples, ahead of playback
    this.queue(msg,latency);
  }
}

WebDirt.prototype.playScoreWhenReady = function(score,latency) {
  this.initializeWebAudio();
  if(latency == null) latency = this.latency;
  var count = score.length;
  for(var i in score) {
    var msg = score[i];
    var closure = this;
    // begin: a temporary kludge
    if(msg.s != null) msg.sample_name = msg.s;
    if(msg.n != null) msg.sample_n = msg.n;
    // end: a temporary kludge
    this.sampleBank.load(msg.sample_name,msg.sample_n,function() {
      count = count - 1;
      if(count<=0) closure.playScore(score,latency);
    });
  }
}

WebDirt.prototype.loadAndPlayScore = function(url,latency) {
  this.initializeWebAudio();
  if(latency == null) latency = this.latency;
  var request = new XMLHttpRequest();
  request.open('GET',url,true);
  request.responseType = "json";
  var closure = this;
  request.onload = function() {
    if(request.readyState != 4) throw Error("readyState != 4 in callback of loadAndPlayScore");
    if(request.status != 200) throw Error("status != 200 in callback of loadAndPlayScore");
    if(request.response == null) throw Error("JSON response null in callback of loadAndPlayScore");
    console.log("playing JSON score from " + url);
    closure.playScoreWhenReady(request.response,latency);
  }
  request.send();
}

WebDirt.prototype.subscribeToTidalSocket = function(url,withLog) {
  this.initializeWebAudio();
  if(withLog == null)withLog = false;
  window.WebSocket = window.WebSocket || window.MozWebSocket;
  console.log("WebDirt: attempting websocket connection to " + url);
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
    else if(msg.args.length != 30 && msg.args.length != 33) throw Error("ERROR: message from tidalSocket with " + msg.args.length + " args instead of 30 or 33: " + m.data);
    else {
      var x = {};
      // var diff = Date.now()/1000 - closure.ac.currentTime;
      x.when = msg.args[0] + (msg.args[1]/1000000) - closure.clockDiff;
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

      if(msg.args.length == 33) {
        x.attack = msg.args[30];
        x.hold = msg.args[31];
        x.release = msg.args[32];
      }

      closure.queue(x);
      if(withLog)console.log(msg);
    }
  };
}
