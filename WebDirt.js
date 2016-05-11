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
