var OUTPUT_CHANNELS=2;

function Graph(msg,ac,sampleBank,compressor){
	this.ac = ac;
	var last,temp;

	this.when = msg.when;

	// get basic buffer player, including speed change and sample reversal
	this.source = last = ac.createBufferSource();
	if(isNaN(parseInt(msg.begin))) msg.begin = 0;
	if(isNaN(parseInt(msg.end))) msg.end = 1;
	this.begin = msg.begin;
	this.end = msg.end;
	var buffer = sampleBank.getBuffer(msg.sample_name,msg.sample_n);
	if(isNaN(parseInt(msg.speed))) msg.speed = 1;
	if(msg.speed>=0 && buffer != null) this.source.buffer = buffer;
	if(msg.speed<0 && buffer != null)  this.source.buffer=this.reverseBuffer(buffer)
	msg.speed = Math.abs(msg.speed)
	this.source.playbackRate.value = msg.speed;

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

	//@Bug - if sample hasn't been loaded before this run and a scriptNode effect is used,
	//this onend function won't fire and the scriptnode handlers will continuously be invoked

	this.negativeAccelerateBuffer(this.source.buffer, msg.accelerate, this.speed);

	//Accelerate
	this.accelerate(msg.accelerate, msg.speed);
	// Distortion
	last = this.shape(last, msg.shape);
	//Lowpass filtering @what level/function to set frequency and resonant gain at?
	last = this.lowPassFilter(last, msg.cutoff, msg.resonance);
	//higpass filtering @what level/function to set frequency and resonant gain at?
	last = this.highPassFilter(last, msg.hcutoff, msg.hresonance)
	//Band Pass Filtering @where to set frequency ranges?
	last = this.bandPassFilter(last, msg.bandf, msg.bandq)
	//Vowel
	last = this.vowel(last, msg.vowel);
	// Delay
	last = this.delay(last,msg.delay,msg.delaytime,msg.delayfeedback);
	//Loop
	last = this.loop(last, msg.loop, msg.begin, msg.end, msg.speed);
	//Coarse
	last = this.coarse(last, msg.coarse);
	//Crush
	last = this.crush(last, msg.crush);
	//Unit

	//Gain
	if(isNaN(parseInt(msg.gain))) msg.gain = 1;
	var gain = ac.createGain();
	gain.gain.value = Math.abs(Math.pow(msg.gain,4));
	last.connect(gain);
	var last = gain;

	//Panning (currently stereo)
	if(isNaN(parseInt(msg.pan))) msg.pan = 0.5;
	var gain1 = ac.createGain();
	var gain2 = ac.createGain();

	//Equal power panning @
	gain1.gain.value = Math.cos(msg.pan*Math.PI/2);
	gain2.gain.value = Math.sin(msg.pan*Math.PI/2);

	last.connect(gain1);
	last.connect(gain2);
	var channelMerger = ac.createChannelMerger(2);
	gain1.connect(channelMerger,0,0);
	gain2.connect(channelMerger,0,1);
	channelMerger.connect(this.ac.destination);

}// End Graph


Graph.prototype.start = function() {
	this.source.onended = this.disconnectHandler();
	this.source.start(this.when,this.begin*this.source.buffer.duration,this.end*this.source.buffer.duration);
}

Graph.prototype.disconnectOnEnd = function(x,y) {
	var obj = {input:x,output:y};
	if(this.disconnectQueue == null) this.disconnectQueue = new Array;
	this.disconnectQueue.push(obj);
}

Graph.prototype.disconnectHandler = function() {
	var closure = this;
	return function() {
		console.log("onend called")
		try{console.log("end playback: " + closure.source.playbackRate.value)}catch(e){console.log(e)}
		if(closure.disconnectQueue == null) return;
		for(var i in closure.disconnectQueue) {
			var x = closure.disconnectQueue[i];
			if(x.input == null) throw Error("first of pair of things to disconnect must exist");
			if(x.output == null) x.input.disconnect();
			else x.input.disconnect(x.output);
		}
	}
}

////////////////////////////////////////////
//             EFFECT FUNCTIONS:          //
////////////////////////////////////////////


Graph.prototype.bandPassFilter=function(input, bandf, bandq){
	//Bandpass Filter
	if(bandf>0 && bandf<1 && bandq>0){
			filterNode = this.ac.createBiquadFilter();
			filterNode.type = 'bandpass';
			filterNode.frequency.value = bandf*10000;
			filterNode.Q.value = bandq;

			input.connect(filterNode);
			return filterNode;
	}
	else return input;
}


//Coarse Effect
Graph.prototype.coarse = function(input, coarse){
	//Safety and msg parsing
	if(isNaN(parseInt(coarse))) coarse = 1;
	coarse=Math.abs(coarse);
	if(coarse>1){
		var	scriptNode = this.ac.createScriptProcessor();

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
			console.log("coarse")
		}//end scriptNode audio processing handler

		input.connect(scriptNode);
		this.disconnectOnEnd(input,scriptNode);
		this.disconnectOnEnd(scriptNode);
		return scriptNode;
	}
	else
		return input
}

//Crush
Graph.prototype.crush = function(input, crush){

	if(isNaN(parseInt(crush))) crush = null;
	if(crush!=null && crush>0){

	var scriptNode = this.ac.createScriptProcessor();
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

		input.connect(scriptNode);
		this.disconnectOnEnd(input,scriptNode);
		this.disconnectOnEnd(scriptNode);
	return scriptNode;
	}
	else
		return input
}//End Crush



//@gain on first hit of something with a delay
Graph.prototype.delay= function(input,outputGain,delayTime,delayFeedback) {
	if(isNaN(parseInt(outputGain))) outputGain = 0;
	outputGain = Math.abs(outputGain);
	if(outputGain!=0){
		var delayNode = this.ac.createDelay();
		if(isNaN(parseInt(delayTime))) {
			console.log("warning: delaytime not a number, using default of 1");
			delayTime = 1;
		}
		delayNode.delayTime.value = delayTime;
		var feedBackGain = this.ac.createGain();
		if(isNaN(parseInt(delayFeedback))) {
			console.log("warning: delayfeedback not a number, using default of 0.5");
			delayFeedback = 0.5;
		}
		feedBackGain.gain.value= delayFeedback;
		var delayGain = this.ac.createGain();
		delayGain.gain.value = outputGain;
		input.connect(delayNode);
		delayNode.connect(feedBackGain);
		delayNode.connect(delayGain);
		feedBackGain.connect(delayNode);
		return delayGain;
	}
	else return input;
}


Graph.prototype.highPassFilter = function (input, hcutoff, hresonance){

	if(hresonance>0 && hresonance<1 && hcutoff>0 && hcutoff<1){
			//Filtering
			filterNode = this.ac.createBiquadFilter();
			filterNode.type = 'highpass';
			filterNode.frequency.value = hcutoff*10000;
			filterNode.Q.value = 0.1;
			input.connect(filterNode);
			input = filterNode;

			//Resonance@
			filterNode = this.ac.createBiquadFilter();
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

//Loop effect
Graph.prototype.loop = function(input, loopCount){

	if(isNaN(parseInt(loopCount)) || loopCount==0) return input

	var dur = this.source.buffer.duration-(this.begin*this.source.buffer.duration)-((1-this.end)*this.source.buffer.duration);
	this.source.loop=true;
	this.source.loopStart = this.begin*this.source.buffer.duration
	this.source.loopEnd = this.end*this.source.buffer.duration
	this.source.stop(this.ac.currentTime+(dur*loopCount)/this.source.playbackRate.value);

	return input;
}

Graph.prototype.lowPassFilter = function(input, cutoff, resonance){

	if(resonance>0 && resonance<=1 && cutoff>0 && cutoff<=1){

			var filterNode = this.ac.createBiquadFilter();
			filterNode.type = 'lowpass';
			filterNode.frequency.value = cutoff*14000;
			filterNode.Q.value = 0.1;

			input.connect(filterNode);
			input = filterNode;

			filterNode = this.ac.createBiquadFilter();
			filterNode.type = 'peaking';
			filterNode.frequency.value = cutoff*1400+100;
			filterNode.Q.value=70;
			filterNode.gain.value = resonance*10;
			input.connect(filterNode);
			return filterNode;
	}
	else return input

}

//@Refine/differentiate?
function makeDistortionCurve(amount){
	var curve = new Float32Array(44100);
	var k = 10*amount/(1-amount);
	for(var i=0; i<44100;i++){
        var x = (i) * (2) / (44100)-1;
        curve[i] = (1 + k) * x / (1+k * Math.abs(x));
	}
return curve;
}


//Accelerate @Still working on negative values
Graph.prototype.accelerate = function(accelerateValue, speed){
	if(isNaN(parseInt(accelerateValue))) accelerateValue = 0;
	if(accelerateValue!=0){
		this.source.playbackRate.setValueAtTime(speed, this.when);
		//If the final playbackrate will be negative... for now just
		//choose a value close to zero@
		if((speed+this.source.buffer.length*(accelerateValue)/this.ac.sampleRate)<0)
			this.source.playbackRate.linearRampToValueAtTime(0.1,this.when+this.source.buffer.duration);
		else
			this.source.playbackRate.linearRampToValueAtTime(speed+this.source.buffer.length*(accelerateValue)/this.ac.sampleRate,this.when+this.source.buffer.duration);
	}
}

Graph.prototype.negativeAccelerateBuffer = function(buffer, accelerateValue, speed){
	var frames = buffer.length;
	var pcmData = new Float32Array(frames);
	var newBuffer = this.ac.createBuffer(buffer.numberOfChannels, buffer.length, this.ac.sampleRate)

	var zeroFrame = (speed/(this.source.buffer.length*accelerateValue/this.ac.sampleRate))*frames;
	console.log(zeroFrame)

	// rate = speed+(frames)*(this.source.buffer.length*(accelerateValue)/this.ac.sampleRate)
	// -speed/

	// (((speed+this.source.buffer.length*(accelerateValue)/this.ac.sampleRate)) = rate*frames+speed
	// 	0=rate*frames+speed
	// 	-speed/rate=frames


	// 	-speed)/frames


}


//Returns a new BufferSourceNode containing a buffer with the reversed frames of the
//parameter 'buffer'
//@channels
Graph.prototype.reverseBuffer= function(buffer){
	var frames = buffer.length;
	var pcmData = new Float32Array(frames);
	var newBuffer = this.ac.createBuffer(buffer.numberOfChannels,buffer.length,this.ac.sampleRate);
	// var source = ac.createBufferSource();
	var newChannelData = new Float32Array(frames);

	for(var channel=0; channel<buffer.numberOfChannels; channel++){
		buffer.copyFromChannel(pcmData,channel,0);
		for (var i =0;i<frames;i++){
			newChannelData[i]=pcmData[frames-i];
		}
		//First element of newChannelData will be set to NaN - causes clipping on first frame
		//set to second element to get rid of clipping
		newChannelData[0]=newChannelData[1];
		newBuffer.copyToChannel(newChannelData,channel,0);
	}
	return newBuffer;
}

Graph.prototype.shape = function (input, shape){
	if (isNaN(parseInt(shape)))return input;

	if(shape!=0) {
		//Distortion limited to [0,1]
		if (Math.abs(shape)>1) shape=1;
		else shape=Math.abs(shape);
		var distortionNode = this.ac.createWaveShaper();

		//@Change makeDistortion Curve?
		distortionNode.curve = makeDistortionCurve(shape);
		distortionNode.oversample = '2x';

		//Connect Distortion to last, and pass on 'last'
		input.connect(distortionNode);
		return distortionNode;
	}
	else
		return input;
}

// //Unit
// Graph.prototype.unit = function(cps){
// 	    a->accelerate = a->accelerate * a->speed * a->cps; // change rate by 1 per cycle
//     a->speed = sample->info->frames * a->speed * a->cps / samplerate;
//     if (isNaN(parseInt(cps)) || cps==null) cps = 1

//     this.accelerate = this.accelerate*this.speed*cps;
// 	this.speed = this.speed*
// }

//Vowel effect
//@ get frequencies from superdirt
Graph.prototype.vowel= function (input, vowel){
	if (vowel=='a'||vowel=='e'||vowel=='i'||vowel=='o'||vowel=='u'){
			var frequencies;
			var q = [5/20,20/20,50/20];
			var gain= this.ac.createGain();

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
				filterNode = this.ac.createBiquadFilter()
				filterNode.type = 'bandpass'
				filterNode.Q.value=1;
				filterNode.frequency.value=frequencies[i];

				input.connect(filterNode);
				//temp.connect(gain);
				input=filterNode;
			}
			var makeupGain = this.ac.createGain();
			makeupGain.gain.value=20;
			filterNode.connect(makeupGain);
			return makeupGain;
	}
	else return input
}


/* Some older functions for effects, may want to refer back to them eventually



//Returns a new BufferSourceNode containing a buffer with the reversed frames of the
//parameter 'buffer'
//@add add more for multi-channel samples
Graph.prototype.reverseBuffer= function(buffer){
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
function speed(buffer,rate){
	var frames = buffer.length;
	var pcmData = new Float32Array(frames);
	var newBuffer = this.ac.createBuffer(buffer.numberOfChannels,Math.trunc(buffer.length/rate),ac.sampleRate);
	var newsource = this.ac.createBufferSource();
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
