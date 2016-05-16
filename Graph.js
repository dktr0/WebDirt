var test= true;
function Graph(msg,ac,sampleBank){
	var last;
	this.source = last = ac.createBufferSource();
	var buffer = sampleBank.getBuffer(msg.sample_name,msg.sample_n);
	this.revBuffer = reverseBuffer(buffer,ac);
	var temp;

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
		if(msg.speed>=0){
				this.source.buffer = buffer;
		}
		else{ 
				this.source = last =reverseBuffer(buffer,ac);
				console.log("here");
				//this.source.connect(ac.destination);
		}


		//Speed
		if(msg.speed != null) this.source.playbackRate.value=Math.abs(msg.speed);

		if(msg.accelerate!=0){
			console.log("accelerate")

			this.source.playbackRate.exponentialRampToValueAtTime(msg.accelerate, this.source.buffer.duration);
		}


		//Distortion Applied
		if(msg.shape!=null){
				//Distortion limited to [0,0.99)
			if (Math.abs(msg.shape)>1) msg.shape=0.99;
			else msg.shape=Math.abs(msg.shape);

			temp = ac.createWaveShaper();

			//@Change makeDistortion Curve?
			temp.curve = makeDistortionCurve(msg.shape*300);
			temp.oversample = '2x';

			//Connect Distortion to last, and pass on 'last'
			last.connect(temp);
			last=temp;
		}

		//Start @....
		// if(msg.begin!=0){
		// 	console.log("buffer length:  " +this.source.buffer.length)
		// 	var pcmData = new Float32Array(this.source.buffer.length);
		// 	var offset = Math.trunc(this.source.buffer.length*msg.begin);

		// 	this.source.buffer.copyFromChannel(pcmData,0,0);
			
		// 	console.log("offset: "+offset)

		// 	var newChannelData = new Float32Array(offset)
		// 	for (var i =0;i<offset;i++){
		// 		newChannelData[i]=pcmData[i+offset];
		// 	}
		// 	var erase = new Float32Array(this.source.buffer.length)
		// 	for(i in erase) i=0;
		// 	this.source.buffer.copyToChannel(erase,0,0)

		// 	this.source.buffer.copyToChannel(newChannelData,0,0);
		//}

		// //begin @makeup gain for messages with a late begin value?
		// if (msg.begin!=0){
		// 	//Set envelope to only make audio loud enough starting at the 'begin' proportion of the sample
		// 	//playback
		// 	var envelope = ac.createGain()
		// 	envelope.gain.value=0;
		// 	envelope.gain.setValueAtTime(1,msg.when+msg.begin*this.source.buffer.duration);
			
		// 	//Start the sample playback earlier to compensate for muted beginning portion.
		// 	msg.when = msg.when-(msg.begin)*this.source.buffer.duration

		// 	last.connect(envelope);
		// 	last=envelope;

		// };

		// //End
		// if (msg.end >0 && msg.end <1) {
		// 	console.log("entered end")
		// 	var envelope = ac.createGain();

		// 	envelope.gain.setValueAtTime(0,msg.when+msg.end*this.source.buffer.duration)

		// 	last.connect(envelope);
		// 	last=envelope;
		// }


		//Reverse
		// if(msg.speed<0){
		// 	// var frames = this.source.buffer.length;
		// 	// var pcmData = new Float32Array(frames);

		// 	// this.source.buffer.copyFromChannel(pcmData,0,0);

		// 	// var newChannelData = new Float32Array(frames);

		// 	// for (var i =0;i<frames;i++){
		// 	// 	newChannelData[i]=pcmData[frames-i];
		// 	// }
		// 	// // var erase = new Float32Array(this.source.buffer.length)
		// 	// // for(i in erase) i=0;
		// 	// // this.source.buffer.copyToChannel(erase,0,0)

		// 	// this.source.buffer.copyToChannel(newChannelData,0,0);

		// 	// //test = !test;
		// 	this.source.buffer=revBuffer;

		// }
		// else{
		// 	this.source.buffer=buffer;

		// }

		//Lowpass filtering @what to do with resonance, and what level/function to set frequency at?
		if(msg.resonance>0 && msg.resonance<=1 && msg.cutoff>0 && msg.cutoff<=1){

			temp = ac.createBiquadFilter();
			temp.type = 'lowpass';
			temp.frequency.value = msg.cutoff*14000;
			temp.Q.value = 0.1;

			last.connect(temp);
			last = temp;


		}

		//hgihpass filtering @what to do with resonance, and what level/function to set frequency at?
		if(msg.hresonance>0 && msg.hresonance<1 && msg.hcutoff>0 && msg.hcutoff<1){
			temp = ac.createBiquadFilter();
			temp.type = 'highpass';
			temp.frequency.value = msg.hcutoff*10000;
			temp.Q.value = 0.1;

			last.connect(temp);
			last = temp;
		}

		//Bandpass Filter
		if(msg.bandf>0 && msg.bandf<1 && msg.bandq>0){
			temp = ac.createBiquadFilter();
			temp.type = 'bandpass';
			temp.frequency.value = msg.bandf*10000;
			temp.Q.value = msg.bandq;

			last.connect(temp);
			last = temp;
		}



		// if(msg.speed>=0){
		// this.source.start(msg.when,msg.begin*this.source.buffer.duration,msg.end*this.source.buffer.duration);
		// }
		// else {
		// 	this.revBuffer.start(msg.when,msg.begin*this.source.buffer.duration,msg.end*this.source.buffer.duration);
		// 	this.revBuffer.connect(ac.destination);
		// }
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

//Returns a new BufferSourceNode with the reversed channel data
function reverseBuffer(buffer,ac){
	var frames = buffer.length;
	var pcmData = new Float32Array(frames);
	var newBuffer = ac.createBuffer(buffer.numberOfChannels,buffer.length,ac.sampleRate);
	var source = ac.createBufferSource();
	buffer.copyFromChannel(pcmData,0,0);

	var newChannelData = new Float32Array(frames);

	for (var i =0;i<frames;i++){
		newChannelData[i]=pcmData[frames-i];
	}
	newBuffer.copyToChannel(newChannelData,0,0);

			// var erase = new Float32Array(this.source.buffer.length)
			// for(i in erase) i=0;
			// this.source.buffer.copyToChannel(erase,0,0)
	source.buffer = newBuffer;
	console.log(source.buffer);
//	newBuffer.copyToChannel(newChannelData,0,0);

	return source;
}