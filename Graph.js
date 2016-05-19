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

	// get basic buffer player, including speed change and sample reversal
	this.source = last = ac.createBufferSource();
	if(typeof msg.begin != 'number') msg.begin = 0;
	if(typeof msg.end != 'number') msg.end = 1;
	this.begin = msg.begin;
	this.end = msg.end;
	var buffer = sampleBank.getBuffer(msg.sample_name,msg.sample_n);
	if(isNaN(parseInt(msg.speed))) msg.speed = 1;
	if(msg.speed>=0 && buffer != null) this.source.buffer = buffer;
	if(msg.speed<0 && buffer != null) {this.source.buffer=buffer; last = reverse(last,ac)};
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

	// // Distortion
	// //if(isNaN(parseInt(msg.shape))) msg.shape = 0;
	last = shape(last, msg.shape, ac);

	//Lowpass filtering @what level/function to set frequency and resonant gain at?
	last = lowPassFilter(last, msg.cutoff, msg.resonance, ac);

	//higpass filtering @what to do with resonance, and what level/function to set frequency at?
	last = highPassFilter(last, msg.hcutoff, msg.hresonance, ac)

	//Band Pass Filtering @where to set frequency ranges?
	last = bandPassFilter(last, msg.bandf, msg.bandq, ac)

	last = vowel(last, msg.vowel, ac);

	// Delay
	last = delay(last,msg.delay,msg.delaytime,msg.delayfeedback);

	//Samle_loop
	/* if (msg.sample_loop>0){
		last.loop=true;
		console.log(last.loop)
		last.connect(ac.destination)
		this.source.start(0)
		return
	} */


	/*For testing otherCoarse (leave here for now)
	last = otherCoarse(last, msg.coarse, ac);
	var crushNode=last;*/

	//Coarse
	//Safety and msg parsing
	if(isNaN(parseInt(msg.coarse))) msg.coarse = 1;
	msg.coarse=Math.abs(msg.coarse);

	var coarseNode;
	//If coarse is valid, coarseNode becomes last with coarseNode effect
	//otherwise, coarseNode becomes last 		
	if(msg.coarse>1){
		//New script processor node	
		coarseNode = coarse(msg.coarse, ac)
		last.connect(coarseNode);
	}
	else coarseNode = last;
	//When last is done playing, disconnects last from coarseNode
	//this is necessary or the processor node's (coarseNode's) handler
	//function will infinitely be invoked
	last.onended=function(){
		last.disconnect(coarseNode)
		coarseNode.disconnect()
	}



	//Crush
	if(isNaN(parseInt(msg.crush))) msg.crush = null;
	else msg.crush=Math.abs(msg.crush)
	var crushNode;

	if(msg.crush!=null && msg.crush>0){
		console.log("hello")
		crushNode=crush(msg.crush, ac)
		coarseNode.connect(crushNode);
	}
	else crushNode = coarseNode;

	coarseNode.onended = function(){
		coarseNode.disconnect(crushNode)
		crushNode.disconnect();
	}





	//Gain
	if(isNaN(parseInt(msg.gain))) msg.gain = 1;
	var gain = ac.createGain();
	// @this should be as per Dirt's mapping...
	gain.gain.value = Math.abs(msg.gain);
	crushNode.connect(gain);
	var last1 = gain;


	//Panning (currently stereo)
	if(isNaN(parseInt(msg.pan))) msg.pan = 0.5;
	var gain1 = ac.createGain();
	var gain2 = ac.createGain();
	gain1.gain.value=1-msg.pan;
	gain2.gain.value=msg.pan;
	// @should do equal power panning or something like that instead, i.e. +3 dB as becomes centre-panned
	last1.connect(gain1);
	last1.connect(gain2);
	var channelMerger = ac.createChannelMerger(2);
	gain1.connect(channelMerger,0,0);
	gain2.connect(channelMerger,0,1);
	channelMerger.connect(ac.destination);

}


//Coarse
//Returns a scriptNode that will create a fake-resampling effect when .connected to another node.
//Note: is important to disconnect what is returned by this function once a sample has finished playing
//otherwise the onaudioprocess function will be called infinitely.
function coarse (coarse, ac){
	var scriptNode = ac.createScriptProcessor();
	scriptNode.onaudioprocess = function(audioProcessingEvent){
		var inputBuffer = audioProcessingEvent.inputBuffer;	
		var outputBuffer = audioProcessingEvent.outputBuffer;
		for (var channel=0;channel<outputBuffer.numberOfChannels; channel++){
			var inputData = inputBuffer.getChannelData(channel);
			var outputData = outputBuffer.getChannelData(channel);
			for(var frame=0; frame<inputBuffer.length; frame++){

				 if(frame%coarse==0) outputData[frame]=inputData[frame];
				else outputData[frame]=outputData[frame-1];				
			}
		}
		console.log("hello")
		//return outputBuffer
	}//end scriptNode audio processing handler 
	
	return scriptNode;
}



//@ is the scriptNode handler continuously called even after it has finished playing?
//how to stop that?
function reverse (input, ac){

	
	var scriptNode = ac.createScriptProcessor();

	input.connect(scriptNode);

	scriptNode.onaudioprocess = function(audioProcessingEvent){
		var inputBuffer = audioProcessingEvent.inputBuffer;
	
		var outputBuffer = audioProcessingEvent.outputBuffer;

		for (var channel=0;channel<outputBuffer.numberOfChannels; channel++){
			var inputData = inputBuffer.getChannelData(channel);
			var outputData = outputBuffer.getChannelData(channel);
			for(var frame=0; frame<inputBuffer.length; frame++){
				outputData[frame]= inputData[inputBuffer.length-frame];
			}//Frames
		}//Channels
		//return outputBuffer
		console.log("input: ");
		console.log(inputData)
		console.log("output: ")
		console.log(outputData);
	}//end scriptNode audio processing handler 

	return scriptNode;
}


//@ is the scriptNode handler continuously called even after it has finished playing?
//how to stop that?
function crush (crush, ac){

	var scriptNode = ac.createScriptProcessor();

	//scriptNode Processing Handler
	scriptNode.onaudioprocess = function(audioProcessingEvent){
		var inputBuffer = audioProcessingEvent.inputBuffer;
		var outputBuffer = audioProcessingEvent.outputBuffer;
		for (var channel=0;channel<outputBuffer.numberOfChannels; channel++){
			var inputData = inputBuffer.getChannelData(channel);
			var outputData = outputBuffer.getChannelData(channel);
			for(var frame=0; frame<inputBuffer.length; frame++){

				outputData[frame]=Math.round(inputData[frame]*Math.pow(2,(crush-1)))/Math.pow(2,(crush-1));
			}//Frames
		}//Channels
	}//end scriptNode audio processing handler 
	return scriptNode;

}//End Crush



























Graph.prototype.start = function() {
	console.log("start")
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

function bandPassFilter(input, bandf, bandq, ac){
	//Bandpass Filter
	if(bandf>0 && bandf<1 && bandq>0){
			filterNode = ac.createBiquadFilter();
			filterNode.type = 'bandpass';
			filterNode.frequency.value = bandf*10000;
			filterNode.Q.value = bandq;

			input.connect(filterNode);
			return filterNode;
	}
	else return input;
}

function highPassFilter (input, hcutoff, hresonance, ac){
	
	if(hresonance>0 && hresonance<1 && hcutoff>0 && hcutoff<1){
			//Filtering
			filterNode = ac.createBiquadFilter();
			filterNode.type = 'highpass';
			filterNode.frequency.value = hcutoff*10000;
			filterNode.Q.value = 0.1;
			input.connect(filterNode);
			input = filterNode;

			//Resonance
			filterNode = ac.createBiquadFilter();
			filterNode.type = 'peaking';
			filterNode.frequency.value = hcutoff*10000+100;
			filterNode.Q.value=70;
			filterNode.gain.value = hresonance*10;
			input.connect(filterNode);

			input.connect(filterNode);
			return filterNode;
	}
	else return input;
}


function lowPassFilter(input, cutoff, resonance, ac){

	if(resonance>0 && resonance<=1 && cutoff>0 && cutoff<=1){

			var filterNode = ac.createBiquadFilter();
			filterNode.type = 'lowpass';
			filterNode.frequency.value = cutoff*14000;
			filterNode.Q.value = 0.1;

			input.connect(filterNode);
			input = filterNode;

			filterNode = ac.createBiquadFilter();
			filterNode.type = 'peaking';
			filterNode.frequency.value = cutoff*1400+100;
			filterNode.Q.value=70;
			filterNode.gain.value = resonance*10;
			input.connect(filterNode);
			return filterNode;
	}
	else return input

}

function shape(input, shape, ac){
	if (isNaN(parseInt(shape)))return input;

	if(shape!=0) {
		//Distortion limited to [0,1]
		if (Math.abs(shape)>1) shape=1;
		else shape=Math.abs(shape);
		var distortionNode = ac.createWaveShaper();

		//@Change makeDistortion Curve?
		distortionNode.curve = makeDistortionCurve(shape*300);
		distortionNode.oversample = '2x';

		//Connect Distortion to last, and pass on 'last'
		input.connect(distortionNode);
		return distortionNode;
	}
	else 
		return input;
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

//Vowel effect
//@ get frequencies from superdirt
function vowel (input, vowel, ac){
	if (vowel=='a'||vowel=='e'||vowel=='i'||vowel=='o'||vowel=='u'){
			var frequencies;
			var q = [5/20,20/20,50/20];
			var gain= ac.createGain();

			switch (vowel){
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
				filterNode = ac.createBiquadFilter()
				filterNode.type = 'bandpass'
				filterNode.Q.value=1;
				filterNode.frequency.value=frequencies[i];

				input.connect(filterNode);
				//temp.connect(gain);
				input=filterNode;
			}
			var makeupGain = ac.createGain();
			makeupGain.gain.value=20;
			filterNode.connect(makeupGain);
			return makeupGain;
	}
	else return input
}






/* Some older functions for effects, may want to refer back to them eventually



//@ is the scriptNode handler continuously called even after it has finished playing?
//how to stop that?
function otherCoarse (input, coarse, ac){
	//Safety and msg parsing
	if(isNaN(parseInt(coarse))) coarse = 1;
	coarse=Math.abs(coarse);

	var coarseNode;
	//If coarse is valid, coarseNode becomes last with coarseNode effect
	//otherwise, coarseNode becomes last 		
	if(coarse>1){
	var scriptNode = ac.createScriptProcessor();
	scriptNode.onaudioprocess = function(audioProcessingEvent){
		var inputBuffer = audioProcessingEvent.inputBuffer;
	
		var outputBuffer = audioProcessingEvent.outputBuffer;

		for (var channel=0;channel<outputBuffer.numberOfChannels; channel++){
			var inputData = inputBuffer.getChannelData(channel);
			var outputData = outputBuffer.getChannelData(channel);
			for(var frame=0; frame<inputBuffer.length; frame++){
				if(frame%coarse==0) outputData[frame]=inputData[frame];
				else outputData[frame]=outputData[frame-1];	
			}//Frames
		}//Channels
		console.log("infinite loop in otherCoarse, scriptNode handler")
	}//end scriptNode audio processing handler 

	input.connect(scriptNode);
	input.onended= function(){input.disconnect(scriptNode)};
	return scriptNode;
	}
	else 
		return input
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

// returns a buffer source with a buffer with bit resolution degraded
// by 'crush'
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



*/

