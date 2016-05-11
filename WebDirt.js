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
