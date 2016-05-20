var OUTPUT_CHANNELS=2;
var vowels={
	a : {frequencies: []},
	e :	{frequencies: [270,2300,3000]},
	i : {frequencies: []},
	o : {frequencies: []},
	u : {frequencies: []}
};

function Graph(msg,ac,sampleBank){
	this.ac = ac;
	var last,temp;
	this.when = msg.when;
	// get basic buffer player, including speed change and sample reversal
	this.source = last = ac.createBufferSource();
	if(typeof msg.begin != 'number') msg.begin = 0;
	if(typeof msg.end != 'number') msg.end = 1;
	this.begin = msg.begin;
	this.end = msg.end;
	var buffer = sampleBank.getBuffer(msg.sample_name,msg.sample_n);
	if(isNaN(parseInt(msg.speed))) msg.speed = 1;
	if(msg.speed>=0 && buffer != null) this.source.buffer = buffer;
	if(msg.speed<0 && buffer != null) this.source.buffer = reverseBuffer(buffer,ac);
	console.log(msg.speed);
	this.source.playbackRate.value=Math.abs(msg.speed);
	if(buffer != null) this.start();
	else { // buffer not available but may be available soon
		var closure = this;
		var reattemptDelay = (msg.when-ac.currentTime-0.2)*1000;
		setTimeout(function(){
			var buffer = sampleBank.getBuffer(msg.sample_name,msg.sample_n);
			if(buffer != null) {
				closure.source.buffer = buffer;
				closure.start();
			}
		  else console.log("unable to access sample " + msg.sample_name + ":" + msg.sample_n + " on second attempt");
		},reattemptDelay);
	}

	// accelerate
	if(isNaN(parseInt(msg.accelerate))) msg.accelerate = 0;
	if(msg.accelerate!=0){
		this.source.playbackRate.exponentialRampToValueAtTime(msg.accelerate, this.source.buffer.duration);
	}

	// Distortion
	if(isNaN(parseInt(msg.shape))) msg.shape = 0;
	if(msg.shape!=0) {
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

	//Lowpass filtering @what level/function to set frequency and resonant gain at?
	if(msg.resonance>0 && msg.resonance<=1 && msg.cutoff>0 && msg.cutoff<=1){

			temp = ac.createBiquadFilter();
			temp.type = 'lowpass';
			temp.frequency.value = msg.cutoff*14000;
			temp.Q.value = 0.1;

			last.connect(temp);
			last = temp;

			temp = ac.createBiquadFilter();
			temp.type = 'peaking';
			temp.frequency.value = msg.cutoff*1400+100;
			temp.Q.value=70;
			temp.gain.value = msg.resonance*10;
			last.connect(temp);
			last = temp;
	}

	//higpass filtering @what to do with resonance, and what level/function to set frequency at?
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

		//Vowel
	if (msg.vowel=='a'||msg.vowel=='e'||msg.vowel=='i'||msg.vowel=='o'||msg.vowel=='u'){
			var frequencies;
			var q = [5/20,20/20,50/20];
			var gains = [1,1,1,0.177,0.354]
			var gain= ac.createGain();

			switch (msg.vowel){
				case('a'):
					frequencies= [730,1090,2440];
					break
				case('e'):
					frequencies = [270,2290,3010];
					break
				case('i'):
					frequencies = [390, 1990,2550];
					break;
				case('o'):
					frequencies = [360,1390, 1090];
					break;
				case('u'):
					frequencies = [520,1190, 2390];
			}
			for(var i=0; i<3; i++){
				temp = ac.createBiquadFilter()
				temp.type = 'bandpass'
				temp.Q.value=1;
				temp.frequency.value=frequencies[i];
				//temp.gain.value=gains[i];
				gain.gain.value =gains[i];
				//temp.connect(gain);
				//temp.connect(gain);
				last.connect(temp);
				//temp.connect(gain);
				last=temp;
			}
			temp = ac.createGain();
			temp.gain.value=20;
			last.connect(temp);
			last=temp;
	}

	//Samle_loop

	/* if (msg.sample_loop>0){
		last.loop=true;
		console.log(last.loop)
		last.connect(ac.destination)
		this.source.start(0)
		return
	} */


	if(isNaN(parseInt(msg.coarse))) msg.coarse = 1;
	msg.coarse=Math.abs(msg.coarse);
	if(msg.coarse>1){
		last = decimate(this.source.buffer,msg.coarse,ac);
	}

	//Crush
	if(isNaN(parseInt(msg.crush))) msg.crush = null;
	if (msg.crush != null){
		last = crush(this.source.buffer, msg.crush, ac)
	}

	// Delay
	last = delay(last,msg.delay,msg.delaytime,msg.delayfeedback);

	//Gain
	if(isNaN(parseInt(msg.gain))) msg.gain = 1;
	var gain = ac.createGain();
	// @this should be as per Dirt's mapping...
	gain.gain.value = Math.abs(msg.gain);
	last.connect(gain);
	last = gain;


	//Panning (currently stereo)
	if(isNaN(parseInt(msg.pan))) msg.pan = 0.5;
	var gain1 = ac.createGain();
	var gain2 = ac.createGain();
	gain1.gain.value=1-msg.pan;
	gain2.gain.value=msg.pan;
	// @should do equal power panning or something like that instead, i.e. +3 dB as becomes centre-panned
	last.connect(gain1);
	last.connect(gain2);
	var channelMerger = ac.createChannelMerger(2);
	gain1.connect(channelMerger,0,0);
	gain2.connect(channelMerger,0,1);
	channelMerger.connect(ac.destination);
}

Graph.prototype.start = function() {
	this.source.start(this.when,this.begin*this.source.buffer.duration,this.end*this.source.buffer.duration);
}


function delay(input,outputGain,delayTime,delayFeedback) {
	if(isNaN(parseInt(outputGain))) outputGain = 0;
	outputGain = Math.abs(outputGain);
	if(outputGain!=0){
		var delayNode = ac.createDelay();
		if(isNaN(parseInt(delayTime))) {
			console.log("warning: delaytime not a number, using default of 1");
			delayTime = 1;
		}
		delayNode.delayTime.value = delayTime;
		var feedBackGain = ac.createGain();
		if(isNaN(parseInt(delayFeedback))) {
			console.log("warning: delayfeedback not a number, using default of 0.5");
			delayFeedback = 0.5;
		}
		feedBackGain.gain.value= delayFeedback;
		var delayGain = ac.createGain();
		delayGain.gain.value = outputGain;
		input.connect(delayNode);
		delayNode.connect(feedBackGain);
		delayNode.connect(delayGain);
		feedbackGain.connect(delayNode);
		return delayGain;
	} else return input;
}

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


/*
function formants(input,vowel) {
	if(typeof vowel != 'string') vowel = null;
	if(vowel != null) {

		filter.connect(input);
		return filter;
	} else return input;
}

var last;

last = formants(last,msg.vowel);
last = crush(last,msg.crush);
last = ...
*/


//returns a buffer source with a buffer with bit resolution degraded
//by 'crush'
function crush(buffer, crush, ac){
	var frames = buffer.length;
	var pcmData = new Float32Array(frames);
	var newBuffer = ac.createBuffer(buffer.numberOfChannels,buffer.length,ac.sampleRate);
	var source = ac.createBufferSource();
	var newChannelData = new Float32Array(frames);
	buffer.copyFromChannel(pcmData,0,0);

	for (var i =0;i<frames;i++){
		newChannelData[i]=Math.round(pcmData[i]*Math.pow(2,(crush-1)))/Math.pow(2,(crush-1));
	}
	console.log(newChannelData)
	newBuffer.copyToChannel(newChannelData,0,0);
	source.buffer = newBuffer;

	return source;
}

//Returns a new BufferSourceNode containing a buffer with the reversed frames of the
//parameter 'buffer'
//@add add more for multi-channel samples
function reverseBuffer(buffer,ac){
	var frames = buffer.length;
	var pcmData = new Float32Array(frames);
	var newBuffer = ac.createBuffer(buffer.numberOfChannels,buffer.length,ac.sampleRate);
	// var source = ac.createBufferSource();
	var newChannelData = new Float32Array(frames);

	buffer.copyFromChannel(pcmData,0,0);
	for (var i =0;i<frames;i++){
		newChannelData[i]=pcmData[frames-i];
	}
	//First element of newChannelData will be set to NaN - causes clipping on first frame
	//set to send element to get rid of clipping
	newChannelData[0]=newChannelData[1];
	newBuffer.copyToChannel(newChannelData,0,0);

	return newBuffer;

//	source.buffer = newBuffer;
//	return source;
}

//Returns BufferSourceNode with a sped up buffer. Volume of samples given a high speed parameter (>~4) is
//better preserved using this function rather than simply altering the playbackRate of the buffer.
function speed(buffer,rate,ac){
	var frames = buffer.length;
	var pcmData = new Float32Array(frames);
	var newBuffer = ac.createBuffer(buffer.numberOfChannels,Math.trunc(buffer.length/rate),ac.sampleRate);
	var newsource = ac.createBufferSource();
	var newChannelData = new Float32Array(newBuffer.length);
	buffer.copyFromChannel(pcmData,0,0);

	for(var i=0; i<newBuffer.length; i++){
		newChannelData[i]=pcmData[i*rate];
	}


	newBuffer.copyToChannel(newChannelData,0,0);
	newsource.buffer = newBuffer;
	return newsource;

}

//Used for coarse effect
function decimate(buffer,rate,ac){
	var frames = buffer.length;
	var pcmData = new Float32Array(frames);
	var newBuffer = ac.createBuffer(buffer.numberOfChannels,buffer.length,ac.sampleRate);
	var newsource = ac.createBufferSource();
	var newChannelData = new Float32Array(newBuffer.length);
	buffer.copyFromChannel(pcmData,0,0);

	for(var i=0; i<newBuffer.length; i++){
		if(i%rate==0){
		newChannelData[i]=pcmData[i];
		}
		else{
		newChannelData[i]=newChannelData[i-1];
		}

	}
	newBuffer.copyToChannel(newChannelData,0,0);
	newsource.buffer = newBuffer;
	return newsource;
 }
