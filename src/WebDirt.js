/*

To create a WebDirt object call new WebDirt, optionally providing arguments in the form of an object.
All of the 'fields' of the object are optional, and can be null/omitted.

var myWebDirt = new WebDirt({
  sampleMapUrl: "mySampleMap.json", // URL to a map of available samples if WebDirt is to manage sample loading, default is null (WebDirt doesn't manage samples)
  sampleFolder: "samples", // URL to where samples are located if WebDirt is to manage sample loading, 'samples' is default
  readyCallback: function () { console.log("ready!")}, // a callback function to execute when sample map is loaded, if WebDirt is to manage sample loading
  latency: 0.4, // a value in seconds by which to delay sample onset (eg. to allow sample loading to succeed in the interim)
  maxLateness: 0.005, //
  audioContext: myAudioContext, // if provided, WebDirt will use this pre-existing Web Audio API context instead of creating a new one
  destination: myDestination // if provided, WebDirt will direct output to this Web Audio node instead of the default destination node of the context
});

*/

import Graph from './Graph.js';
import SampleBank from './SampleBank.js';

export function WebDirt(args) {
  this.workletsAvailable = false; // changes to true when worklets loaded
  if(typeof args === 'undefined') args = {};
  if(typeof args != 'object') {
    console.log("WebDirt: unable to construct WebDirt object, arguments object not provided to constructor");
    return;
  }
  if(typeof args.sampleMapUrl === 'string') {
    if(args.sampleFolder == null) args.sampleFolder = "samples";
    console.log("WebDirt: will manage own sample bank, samplemap=" + args.sampleMapUrl + " sampleFolder=" + args.sampleFolder);
    this.sampleBank = new SampleBank(args.sampleMapUrl,args.sampleFolder,args.readyCallback);
  } else console.log("WebDirt: will expect application to provide sample buffers");
  if(args.latency == null) args.latency = 0.4;
  this.latency = args.latency;
  if(typeof args.maxLateness != 'number') {
    this.maxLateness = 0.005;
  } else this.maxLateness = args.maxLateness;
  this.ac = args.audioContext;
  this.destination = args.destination;
  this.cutGroups = new Array;
  this.eventCounter = 0;
  this.audioOutputs = 2; // ie. defaults to stereo, change with [WebDirt].audioOutputs = n...;
  if(this.ac == null) {
    console.log("WebDirt: initialized (without audio context)");
  } else {
    if(this.destination == null) {
      this.destination = this.ac.destination;
      console.log("WebDirt: initialized with provided context");
    } else {
      console.log("WebDirt: initialized with provided context + destination")
    }
  }
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
      this.destination = this.ac.destination;
      console.log("WebDirt: own audio context created");
    }
    catch(e) {
      console.log(e);
      alert('Web Audio API is not supported in this browser');
      return;
    }
  }
  if(this.ac != null) {
    if(this.ac.audioWorklet != null) {
      this.ac.audioWorklet.addModule('WebDirt/AudioWorklets.js').then( () => { // *** WARNING: path is not robust to different installation patterns here
        console.log("WebDirt: audio worklets added");
        this.workletsAvailable = true;
      }).catch( err => {
        console.log("WebDirt: error loading AudioWorklets.js: " + err);
        console.log("(WebDirt should still work but shape, coarse, and crush will have no effect)");
        this.workletsAvailable = false;
      });
    } else {
      console.log("WebDirt: browser does not support audio worklets");
      console.log("(WebDirt should still work but shape, coarse, and crush will have no effect)");
      this.workletsAvailable = false;
    }
    this.tempo = {time:this.ac.currentTime,beats:0,bpm:30};
    this.clockDiff = (Date.now() / 1000) - this.ac.currentTime;
    if(this.sampleBank != null) this.sampleBank.ac = this.ac;

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
  }
  console.log("WebDirt: initializeWebAudio finished.")
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

  let r = new Graph(msg,this);
  this.eventCounter++;
  return r;
}


WebDirt.prototype.playScore = function(score,latency,finishedCallback) {
  // where score is an array of message objects (each of which fulfills same expectations as the method 'playSample' above)
  // if no second argument (latency) is given, then latency defaults to latency default of this WebDirt instance
  this.initializeWebAudio();
  if(latency == null) latency = this.latency;
  var start = this.ac.currentTime;
  var latestOnset = 0;
  for(var i=0; i<score.length; i++) {
    var msg = score[i];
    if(msg.when > latestOnset) latestOnset = msg.when;
    msg.when = msg.when + start;
    // begin: a temporary kludge
    if(msg.s != null) msg.sample_name = msg.s;
    if(msg.n != null) msg.sample_n = msg.n;
    // end: a temporary kludge
    this.playSample(msg,latency);
  }
  setTimeout(function() {
    if(typeof finishedCallback == 'function') {
      finishedCallback();
    }
  },(latestOnset+latency)*1000);
}

WebDirt.prototype.playScoreWhenReady = function(score,latency,readyCallback,finishedCallback) {
  this.initializeWebAudio();
  if(latency == null) latency = this.latency;
  var count = score.length;
  for(var i=0;i<score.length;i++) {
    var msg = score[i];
    var closure = this;
    // begin: a temporary kludge
    if(msg.s != null) msg.sample_name = msg.s;
    if(msg.n != null) msg.sample_n = msg.n;
    // end: a temporary kludge
    if(this.sampleBank != null) this.sampleBank.load(msg.sample_name,msg.sample_n,function() {
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
      x.when = msg.args[0] + (msg.args[1]/1000000) + closure.clockDiff;
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

WebDirt.prototype.sampleHint = function(x) {
  if(this.sampleBank != null) {
    console.log("WebDirt received sample hint: " + x);
    this.sampleBank.loadAllNamed(x);
  }
}
