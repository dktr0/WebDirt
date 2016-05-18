
function Graph(msg,ac,sampleBank){
	var last;
	this.source = last = ac.createBufferSource();
	var buffer = sampleBank.getBuffer(msg.sample_name,msg.sample_n);
	if(buffer == null) { // buffer not available but may be available soon
		var closure = this;
		var reattemptDelay = (msg.when-ac.currentTime-0.2)*1000;
		setTimeout(function(){
			var buffer = sampleBank.getBuffer(msg.sample_name,msg.sample_n);
			if(buffer != null) {
				closure.source.buffer = buffer;
				if(msg.speed != null) closure.source.playbackRate.value=msg.speed;
				closure.source.start(msg.when);
			} else {
				console.log("unable to access sample " + msg.sample_name + ":" + msg.sample_n + " on second attempt");
				// closure.cleanup();
			}
		},reattemptDelay);
	}
	else { // buffer is currently available
		this.source.buffer = buffer;
		if(msg.speed != null) this.source.playbackRate.value=msg.speed;
		this.source.start(msg.when);
	}

	/* other plugins here */

	/*
	if(someCondition) {
		var b = ac.createSomeOptionalAudioNode();
		last.connect(b); last = b;
	}
	*/

	last.connect(ac.destination);
}

	// this.shape = webDirt.createWaveShaper();
	// //400 chosen arbitrarily?
	// this.shape.curve.value = makeDistortionCurve(400);

	// this.source.connect(this.shape);



// 	console.log(this.source.buffer.numberOfChannels);
// 	console.log(this.source.buffer.getChannelData(0).length);

// 	var array = new Float32Array;

// 	array = this.source.buffer.getChannelData(0);
// 	//this.source.buffer.copyFromChannel(array,0,0);


// 	// array =this.source.buffer.getChannelData(0);
// 	var i = 0;
// 	while (i<array.length){

// 		if (i%2==0)
// 			array[i]==array[i]
// 		else array[i]=0;
// 	i++;
// 	}

// 	console.log(array)



// 	console.log(array[0] +", " + array.length);
// 	this.source.buffer = array;
// //	this.source.buffer.copyToChannel(array,0,0);

//Borrowed from documentation @may want to redo/make differently
function makeDistortionCurve(amount) {
  var k = typeof amount === 'number' ? amount : 50,
    n_samples = 44100,
    curve = new Float32Array(n_samples),
    deg = Math.PI / 180,
    i = 0,
    x;
  for ( ; i < n_samples; ++i ) {
    x = i * 2 / n_samples - 1;
    curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
  }
  return curve;
};

//timeout for when




	// if(msg.begin>1 || msg.begin <0)
	// 		this.begin =0;
	// else
	// 	this.begin=msg.begin;

	// if(msg.end>1 || msg.end <0){
	// 	this.end =1;
	// }

	// if(msg.speed<0){
	// 	this.speed = abs(msg.speed);
	// 	this.reverse= true;
	// }
	// else{
	// 	this.speed=msg.speed
	// 	this.reverse = false;
	// }

	// if(abs(msg.pan)>1){
	// 	this.pan=1
	// }
	// else{
	// 	this.pan= abs(msg.pan)
	// }

	// //LPF Parameters
	// //Defaults to no filtering if value outside [0,1] is given.
	// if(msg.cutoff<0 ||msg.cutoff>1){
	// 	this.cutoff=1;
	// }
	// else {
	// 	this.cutoff=msg.cutoff;
	// }

	// if(msg.resonance<0 || msg.resonance>1){
	// 	this.resonance=1;
	// }
	// else {
	// 	this.resonance=msg.resonance;
	// }

	// //Accelerate
	// this.accelerate=msg.accelerate;

	// //Distortion limited to [0,0.99)
	// if (abs(distortion)>1) this.distortion =0.99;
	// else this.distortion=abs(msg.distortion);

	// //gain
	// this.gain = abs(msg.gain);

	// //cut
	// if (msg.cut>0) this.cut = 1;
	// else if (msg.cut<0) this.cut = -1;
	// else this.cut = 0;

	// //Delay
	// if (abs(msg.delay)>1) this.delay=1;
	// else this.delay = abs(msg.delay);
	// if(msg.delayTime>0) this.delayTime= msg.delayTime;
	// else this.delayTime= -1;
	// if (msg.delayFeedback>1) this.delayFeedback=1;
	// else if (msg.delayFeedback<0) this.delayFeedback = 0; //
	// else this.delayFeedback=msg.delayFeedback;

	// //Coarse
	// this.coarse = abs(msg.coarse);

	// //HPF Parameters
	// //Defaults to no filtering if value outside [0,1] is given.
	// if(msg.hcutoff<0 ||msg.hcutoff>1){
	// 	this.hcutoff=0;
	// }
	// else {
	// 	this.cutoff=msg.cutoff;
	// }

	// if(msg.hresonance<0 || msg.hresonance>1){
	// 	this.hresonance=1;
	// }
	// else {
	// 	this.hresonance=msg.hresonance;
	// }

	// //Band Pass Filter
	// if (abs(msg.bandf))
	// this.bandf=abs(msg.bandf)

//script processor node -- inefficient..
//pan - gain per channel
//accelerate - playback.(envelope of some kind)
//crush and coarse - more difficutl
//this.source.loop=true;
//distortion - in webaudioapi..
