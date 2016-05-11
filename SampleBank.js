

SimpleMonoSample = function(url) {
  this.url = url;
  var request = new XMLHttpRequest();
  request.open('GET',url,true);
  request.responseType = 'arraybuffer';
  var closure = this; // a closure is necessary for...
  request.onload = function() {
      var data = request.response;
      ac.decodeAudioData(data, function(x) {
        console.log("buffer loaded");
        closure.buffer = x; // ...the decoded data to be kept in the object
      },
      function(err) {
        console.log("error decoding buffer");
      });
  };
  request.send();
  this.gain = ac.createGain();
  this.gain.connect(ac.destination);
  this.playing = false;
}

SimpleMonoSample.prototype.play = function (amp,dur,rate,startPos) {
  if(amp == null) amp = 1;
  if(rate == null) rate = 1; // if 2nd argument not given, defaults to 1
  if(startPos == null) startPos = 0.0; // if 3rd arg not given, defaults 0
  if(this.playing == false) { // only play if not already playing
    this.playing = true;
    this.source = ac.createBufferSource();
    this.source.playbackRate.value = rate;
    this.source.buffer = this.buffer;
    this.source.connect(this.gain);
    var now = ac.currentTime;
    this.source.start(now,startPos);
    this.gain.gain.setValueAtTime(0,now);
    this.gain.gain.linearRampToValueAtTime(amp,now+0.003); // 3 ms fade-in
    if (dur > 0){
      this.gain.gain.linearRampToValueAtTime(amp,now+dur-0.003);  // hold
      this.gain.gain.linearRampToValueAtTime(0,now+dur);  // 3 ms fade-out
    }
    var closure = this;
    setTimeout(function() {
      closure.playing = false; // make synth available again...
    },(dur*1000)+250); // ...a quarter second after envelope finishes
  } else console.log("warning: attempt to play synth that was already playing");
}

function apertInitialize() {
  simpleMonoSampleBank = new Array(10);
  for(var n=0;n<10;n++) {
    console.log("created synth " + n)
    // simpleMonoSampleBank[n] = new SimpleMonoSample("uhoh-mono-16bit.wav");
    simpleMonoSampleBank[n] = new SimpleMonoSample("RockScrape11.wav");
  }
}

function playSimpleMonoSample(amp,dur,rate,startPos) {
  var n;
  for(n=0;n<10;n++) {
    if(simpleMonoSampleBank[n].playing==false)break;
  }
  if(n<10) {
    simpleMonoSampleBank[n].play(amp,dur,rate,startPos);
  }
  else console.log("warning: all synth instances already plaing");
}

function simpleSaw(freq,amp) {
	var sine = ac.createOscillator();
	sine.type = 'sawtooth';
	sine.frequency.value = freq;
	var gain = ac.createGain();
	sine.connect(gain);
	gain.connect(ac.destination);
	sine.start();
	// envelope
	var now = ac.currentTime;
	gain.gain.setValueAtTime(0,now);
  gain.gain.linearRampToValueAtTime(amp,now+0.005); gain.gain.linearRampToValueAtTime(0,now+0.405);
	// schedule cleanup
	setTimeout(function() {
		sine.stop();
		sine.disconnect(gain);
		gain.disconnect(ac.destination);
	},1000);
};

function generativeSaw(freqs,amp) {
  var temp = [220,330,440,550,660,770,880,990,1100];
  var freq = temp[Math.floor(Math.random()*temp.length)];
	var sine = ac.createOscillator();
	sine.type = 'sawtooth';
	sine.frequency.value = freq;
	var gain = ac.createGain();
	sine.connect(gain);
	gain.connect(ac.destination);
	sine.start();
	// envelope
	var now = ac.currentTime;
	gain.gain.setValueAtTime(0,now);
  gain.gain.linearRampToValueAtTime(amp,now+0.005); gain.gain.linearRampToValueAtTime(0,now+0.405);
	// schedule cleanup
	setTimeout(function() {
		sine.stop();
		sine.disconnect(gain);
		gain.disconnect(ac.destination);
	},1000);
};
