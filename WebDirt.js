WebDirt = function() {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  try {
    this.ac = new AudioContext();
    console.log("WebDirt audio context created");
  }
  catch(e) {
    alert('Web Audio API is not supported in this browser');
  }
  this.sampleBank = new SampleBank('samples',this.ac);
  this.sampleBank.load('cp/HANDCLP0.wav');
  this.sampleBank.load('cp/HANDCLPA.wav');
}

WebDirt.prototype.test = function() {
  var source = this.ac.createBufferSource();
  source.buffer = this.sampleBank.getBuffer('cp/HANDCLP0.wav');
  source.connect(this.ac.destination);
  var soon = this.ac.currentTime+0.1;
  source.start(soon);
}
