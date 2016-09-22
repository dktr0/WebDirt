WebDirt = function(sampleMapUrl,sampleFolder,latency,readyCallback,maxLateness) {
  if(sampleMapUrl == null) sampleMapUrl = "sampleMap.json";
  if(sampleFolder == null) sampleFolder = "samples";
  if(latency == null) latency = 0.4;
  this.latency = latency;
  if(typeof maxLateness != 'number') {
    this.maxLateness = 0.005;
  } else this.maxLateness = maxLateness;
  console.log("WebDirt maximum lateness = " + this.maxLateness);
  this.sampleMapUrl = sampleMapUrl;
  this.sampleFolder = sampleFolder;
  this.sampleBank = new SampleBank(this.sampleMapUrl,this.sampleFolder,readyCallback);

  this.cutGroups = new Array;
}

// note: the constructor above does not initialize the Web Audio context.
// this is deliberate in order to support the way things work on iOS, where
// the audio context must be initialized in response to a user interaction.
// each of the methods below the next method (playSample, playScore, playScoreWhenReady,
// loadAndPlayScore,subscribeToTidalSocket) call initializeWebAudio (which has
// been written to only allow itself to run once) so it is _not_ expected that you call
// initializeWebAudio yourself. However, for things to work on iOS, you should
// make sure that that initializeWebAudio is called from a user interaction
// before any other potential calls to initializeWebAudio.

WebDirt.prototype.initializeWebAudio = function() {
  if(this.ac == null) {
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ac = new AudioContext();
      console.log("WebDirt audio context created");
      this.tempo = {time:this.ac.currentTime,beats:0,bpm:30};
      this.clockDiff = Date.now()/1000 - this.ac.currentTime;
      this.sampleBank.ac = this.ac;
    }
    catch(e) {
      console.log(e);
      alert('Web Audio API is not supported in this browser');
    }
  }
  if(this.ac != null) {
 
    this.compressor = this.ac.createDynamicsCompressor();
    this.compressor.threshold.value= 20; //value taken in decibels
    this.compressor.knee.value = 10; //Low/hard knee
    this.compressor.ratio.value = 4;
    this.compressor.reduction.value = 0; //No gain reduction
    this.compressor.attack.value = 0.05;
    this.compressor.release.value = 0.1; //More slowly go back.

    this.analyser = this.ac.createAnalyser();
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.ac.destination);
    // this.soundMeter();

    this.silentNote = this.ac.createOscillator();
    this.silentNote.type = 'sine';
    this.silentNote.frequency.value = 440;
    this.silentGain = this.ac.createGain();
    this.silentGain.gain.value = 0;
    this.silentNote.connect(this.silentGain);
    this.silentGain.connect(this.ac.destination);
    this.silentNote.start();
    var closure = this;
    setTimeout(function() {
      closure.silentGain.disconnect(closure.ac.destination);
      closure.silentNote.disconnect(closure.silentGain);
      closure.silentNote.stop();
      closure.silentGain = null;
      closure.silentNote = null;
    },500);
    console.log("WebDirt global audio resources allocated");
  }
}


WebDirt.prototype.playSample = function(msg,latency) {
  // this.initializeWebAudio();
  if(latency == null) latency = this.latency;
  if(msg.whenPosix != null) {
    // a little hack to allow sample times to be specified in POSIX epoch
    // it would be better to only calculate the difference between web audio time and POSIX time infrequently
    // and even better still for WebDirt clients to interrogate the web audio context time
    // and use that in the generation of times for WebDirt events
    msg.when = msg.whenPosix - (((new Date).getTime()/1000.0) - this.ac.currentTime);
  }
	if(msg.when==null) msg.when = this.ac.currentTime; // a sample without a 'when' is played 'now'(+latency)
  msg.when = msg.when + latency;

  if(typeof msg.maxLateness != 'number') msg.maxLateness = this.maxLateness; // if specific maxLateness not set, use default embedded in WebDirt object
  if((this.ac.currentTime - msg.when)>msg.maxLateness) {
    console.log("WebDirt warning: dropping msg late by " + (this.ac.currentTime-msg.when) + " seconds" );
    return;
  }

  var graph = new Graph(msg,this.ac,this.sampleBank,this.compressor,this.cutGroups);
}

WebDirt.prototype.soundMeter = function () {
  console.log(this.analyser);
  var scriptNode = this.ac.createScriptProcessor(2048, 1, 1);// @2?
  this.analyser.connect(scriptNode);
  this.analyser.smoothingTimeConstant = 0.9;
  this.analyser.fftSize = 1024;

  var canvas = document.getElementById('soundMeter'); // in your HTML this element appears as <canvas id="mycanvas"></canvas>
  var ctx = canvas.getContext('2d');

  var gradient = ctx.createLinearGradient(0,0,0,300);
  gradient.addColorStop(1,'#000000');
  gradient.addColorStop(0.75,'#ff0000');
  gradient.addColorStop(0.25,'#ffff00');
  gradient.addColorStop(0,'#ffffff');


  var analyser = this.analyser
  scriptNode.onaudioprocess = function() {

      var array =  new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      var average = getAverageVolume(array)
      ctx.clearRect(0, 0, 60, 130);
      ctx.fillStyle=gradient;
      // create the meters
      ctx.fillRect(0,130-average,25,130);
  }

    function getAverageVolume(array) {
        var values = 0;
        var average;
        var length = array.length;
        for (var i = 0; i < length; i++) {
            values += array[i];
        }
        average = values / length;
        return average;
    }

}

WebDirt.prototype.playScore = function(score,latency,finishedCallback) {
  // where score is an array of message objects (each of which fulfills same expectations as the method 'playSample' above)
  // if no second argument (latency) is given, then latency defaults to latency default of this WebDirt instance
  this.initializeWebAudio();
  if(latency == null) latency = this.latency;
  var start = this.ac.currentTime;
  var latestOnset = 0;
  for(var i in score) {
    var msg = score[i];
    if(msg.when > latestOnset) latestOnset = msg.when;
    msg.when = msg.when + start;
    // begin: a temporary kludge
    if(msg.s != null) msg.sample_name = msg.s;
    if(msg.n != null) msg.sample_n = msg.n;
    // end: a temporary kludge
    // this.sampleBank.load(msg.sample_name,msg.sample_n); // make an early attempt to load samples, ahead of playback
    this.playSample(msg,latency);
  }
  if(typeof finishedCallback == 'function') {
    setTimeout(function() {
      finishedCallback();
    },(latestOnset+latency)*1000);
  }
}

WebDirt.prototype.playScoreWhenReady = function(score,latency,readyCallback,finishedCallback) {
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
      if(count<=0) {
        closure.playScore(score,latency,finishedCallback);
        if(typeof readyCallback == 'function')readyCallback();
      }
    });
  }
}

WebDirt.prototype.loadAndPlayScore = function(url,latency,readyCallback,finishedCallback) {
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
    closure.playScoreWhenReady(request.response,latency,readyCallback,finishedCallback);
  }
  request.send();
}

WebDirt.prototype.renderAndPlayScore = function(serverUrl,pattern,cps,cycles,latency,readyCallback,finishedCallback) {
  this.initializeWebAudio();
  if(latency == null) latency = this.latency;
  window.WebSocket = window.WebSocket || window.MozWebSocket;
  console.log("WebDirt.renderAndPlayScore: attempting websocket connection to " + serverUrl);
  var socket = new WebSocket(serverUrl);
  socket.onerror = function() {
    console.log(" ERROR opening websocket connection to " + serverUrl);
  };
  socket.onopen = function() {
    console.log(" websocket connection to " + serverUrl + " established");
    try {
      var msg = "{\"render\":" + JSON.stringify(pattern) + ",\"cps\":" + cps + ",\"cycles\":" + cycles + "}";
      console.log(msg);
      socket.send(msg);
      // socket.send(JSON.stringify({render:pattern,cps:cps,cycles:cycles}));
      console.log(" render request sent");
    }
    catch(e) {
      console.log(" EXCEPTION during transmission of render request");
      socket.close();
    }
  };
  var closure = this;
  socket.onmessage = function(m) {
    var msg = JSON.parse(m.data);
    if(! msg instanceof Array) {
      console.log(" WebDirt warning: rendering socket received non-array message");
      console.log(typeof msg);
      globalX = msg;
      return;
    };
    console.log(" received score from " + serverUrl);
    closure.playScoreWhenReady(msg,latency,readyCallback,finishedCallback);
    console.log(" closing websocket connection to " + serverUrl);
    socket.close();
  }
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

      closure.playSample(x);
      if(withLog)console.log(msg);
    }
  };
}

WebDirt.prototype.getCurrentTime = function () {
  return this.ac.currentTime;
}

WebDirt.prototype.syncWithEsp = function (url) {
  if(typeof EspClient != 'function') {
    console.log("WebDirt ERROR: syncWithEsp called but EspClient does not exist");
    return;
  }
  if(this.espClient == null) {
    this.espClient = new EspClient(url,this.ac);
    var closure = this;
    this.espClient.tempoCallback = function (x) {
      closure.tempo = x;
    };
  }
  else {
    this.espClient.setUrl(url);
  }
}

WebDirt.prototype.setTempo = function(x) {
  if(typeof x.time != 'number') throw Error("WebDirt: no time in setTempo");
  if(typeof x.beats != 'number') throw Error("WebDirt: no beats in setTempo");
  if(typeof x.bpm != 'number') throw Error("WebDirt: no bpm in setTempo");
  if(this.espClient != null) this.espClient.sendSetTempo(x);
  this.tempo = x;
}
