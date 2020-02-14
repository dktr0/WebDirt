var cps = 1;
function Graph(msg,ac,sampleBank,outputNode, cutGroups){
	this.cutGroups=cutGroups
	this.ac = ac;
	var last,temp;
	this.when = msg.when;

	// get basic buffer player, including speed change and sample reversal
	this.source = last = ac.createBufferSource();
	this.disconnectOnEnd(this.source);
	if(isNaN(parseInt(msg.begin))) msg.begin = 0;
	if(isNaN(parseInt(msg.end))) msg.end = 1;
	this.begin = msg.begin;
	this.end = msg.end;

	var buffer = sampleBank.getBuffer(msg.sample_name,msg.sample_n);

	if(isNaN(parseInt(msg.speed))) msg.speed = 1;
	if(isNaN(parseInt(msg.note))) msg.note = 0;
	msg.speed = msg.speed * Math.pow(2,msg.note/12);

	//^if(msg.speed>=0 && buffer != null) this.source.buffer = buffer;
	if(msg.speed<0 && buffer != null)  buffer =this.reverseBuffer(buffer) //^
	msg.speed = Math.abs(msg.speed)
	this.source.playbackRate.value = msg.speed;

	//Accelerate
	//Note: because accelerate relies on manipulating raw buffer values, the buffer must be modified
	//      before setting the source's buffer equal to something (the WA API doesn't allow for the
	//      buffer property to be reset)
	buffer = this.accel(buffer, msg.accelerate, msg.speed);

	if(buffer != null) {
		this.source.buffer = buffer;
		this.start();
	}
	else { // buffer not available but may be available soon
		var closure = this;
		var reattemptDelay = (msg.when-ac.currentTime-0.2)*1000;
		setTimeout(function(){
			var buffer = sampleBank.getBuffer(msg.sample_name,msg.sample_n);
			//Still need to apply all effects that rely on buffer manipulation:
			buffer = closure.accel(buffer,msg.accelerate,msg.speed);
			if(buffer != null) {
				closure.source.buffer = buffer;
				closure.start();
			}
			else {
				console.log("WebDirt: unable to access sample " + msg.sample_name + ":" + msg.sample_n + " on second attempt");
				closure.stopAll();
			}
		},reattemptDelay);
	}


	//Cut
	this.cut(msg.cut, msg.sample_name);
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
	//Crush
	last = this.crush(last, msg.crush);
	//Coarse
	last = this.coarse(last, msg.coarse);

	this.unit(msg.unit,msg.speed);

	//Gain
	if(isNaN(parseFloat(msg.gain))) msg.gain = 1;
	if(msg.gain > 2) msg.gain = 2;
	if(msg.gain < 0) msg.gain = 0;
	if(isNaN(parseFloat(msg.overgain))) msg.overgain = 0;
	this.gain = ac.createGain();
	this.disconnectOnEnd(this.gain);
	this.gain.gain.value = Math.abs(Math.pow(msg.gain+msg.overgain,4));
	last.connect(this.gain);
	var last = this.gain;

	//Panning (currently stereo)
	if(isNaN(parseFloat(msg.pan))) msg.pan = 0.5;
	var gain1 = ac.createGain();
	this.disconnectOnEnd(gain1);
	var gain2 = ac.createGain();
	this.disconnectOnEnd(gain2);

	//Equal power panning @
	gain1.gain.value = Math.cos(msg.pan*Math.PI/2);
	gain2.gain.value = Math.sin(msg.pan*Math.PI/2);

	last.connect(gain1);
	last.connect(gain2);
	var channelMerger = ac.createChannelMerger(2);
	this.disconnectOnEnd(channelMerger);
	gain1.connect(channelMerger,0,0);
	gain2.connect(channelMerger,0,1);
	channelMerger.connect(outputNode);

}// End Graph

Graph.prototype.disconnectOnEnd = function(x) {
	if(this.source.disconnectQueue == null) this.source.disconnectQueue = new Array;
	this.source.disconnectQueue.unshift(x);
}

Graph.prototype.start = function() {
	this.source.onended = this.disconnectHandler();
	this.source.start(this.when,this.begin*this.source.buffer.duration,this.end*this.source.buffer.duration);
}

Graph.prototype.stopAll = function() {
	if(this.source.disconnectQueue != null) {
		for(var i in this.source.disconnectQueue) {
			this.source.disconnectQueue[i].disconnect();
		}
		this.source.disconnectQueue = null;
		try { this.source.stop(); } catch(e) {}
	}
}

Graph.prototype.disconnectHandler = function() {
	var closure = this.source;
	return function() {
		if(closure.disconnectQueue == null) { throw Error("WebDirt: no disconnectQueue"); }
		for(var i in closure.disconnectQueue) { closure.disconnectQueue[i].disconnect(); }
		closure.disconnectQueue = null;
	}
}

////////////////////////////////////////////
//             EFFECT FUNCTIONS:          //
////////////////////////////////////////////


Graph.prototype.bandPassFilter=function(input, bandf, bandq){
	//Bandpass Filter
	if(bandf>0 && bandf<1 && bandq>0){
			filterNode = this.ac.createBiquadFilter();
			this.disconnectOnEnd(filterNode);
			filterNode.type = 'bandpass';
			filterNode.frequency.value = bandf;
			filterNode.Q.value = bandq;

			input.connect(filterNode);
			return filterNode;
	}
	else return input;
}

Graph.prototype.coarse = function(input, coarse){
  coarse = parseInt(coarse);
  if(isNaN(coarse)) coarse = 1;
  if(coarse > 1 && this.ac.audioWorklet != null) {
    var coarseProcessorNode = new AudioWorkletNode(this.ac,'coarse-processor');
    coarseProcessorNode.parameters.get('coarse').value = coarse;
    input.connect(coarseProcessorNode);
    this.disconnectOnEnd(coarseProcessorNode);
    return coarseProcessorNode;
  } else {
    return input;
  }
}

Graph.prototype.crush = function(input, crush){
  crush = parseInt(crush);
  if(isNaN(crush)) crush = null;
  if(crush!=null && crush>0 && this.ac.audioWorklet != null) {
    var crushProcessorNode = new AudioWorkletNode(this.ac,'crush-processor');
    crushProcessorNode.parameters.get('crush').value = crush;
    input.connect(crushProcessorNode);
    this.disconnectOnEnd(crushProcessorNode);
    return crushProcessorNode;
  } else {
    return input;
  }
}

//Cut
Graph.prototype.cut = function(cut, sample_name){
	if (cut!=0 && !isNaN(parseInt(cut))){
		if(isNaN(cut)) cut = parseInt(cut)
		var group = {cutGroup: cut, node: this, sampleName: sample_name}

		for(var i =0; i<this.cutGroups.length; i++){
			if(group.cutGroup > 0){
				if(this.cutGroups[i].cutGroup == group.cutGroup){
					this.cutGroups[i].node.stop(this.when);
					this.cutGroups.splice(i,1);
					this.cutGroups.push(group);
					return;
				}
			}
			else{
				if(this.cutGroups[i].cutGroup == group.cutGroup && group.sampleName==this.cutGroups[i].sampleName){

					this.cutGroups[i].node.stop(this.when);
					this.cutGroups.splice(i,1);
					this.cutGroups.push(group);
					return;
				}
			}
		}
		this.cutGroups.push(group);
	}
}//End Cut

//Delay effect
Graph.prototype.delay= function(input,outputGain,delayTime,delayFeedback) {
	if(isNaN(parseInt(outputGain))) outputGain = 0;
	outputGain = Math.abs(outputGain);
	if(outputGain!=0){
		var delayNode = this.ac.createDelay();
		this.disconnectOnEnd(delayNode);
		if(isNaN(parseInt(delayTime))) {
			console.log("WebDirt: warning: delaytime not a number, using default of 1");
			delayTime = 1;
		}
		delayNode.delayTime.value = delayTime;
		var feedBackGain = this.ac.createGain();
		this.disconnectOnEnd(feedBackGain);
		if(isNaN(parseInt(delayFeedback))) {
			console.log("WebDirt: warning: delayfeedback not a number, using default of 0.5");
			delayFeedback = 0.5;
		}
		feedBackGain.gain.value= Math.min(Math.abs(delayFeedback), 0.995);
		var delayGain = this.ac.createGain();
		this.disconnectOnEnd(delayGain);
		delayGain.gain.value = outputGain;
		input.connect(delayNode);
		delayNode.connect(feedBackGain);
		delayNode.connect(delayGain);
		delayGain.gain.setValueAtTime(delayGain.gain.value, this.when+parseFloat(delayTime))
		feedBackGain.connect(delayNode);
		return delayGain;
	}
	else return input;
}//End Delay


Graph.prototype.highPassFilter = function (input, hcutoff, hresonance){

	if(hresonance>0 && hresonance<1 && hcutoff>0){
			//Filtering
			filterNode = this.ac.createBiquadFilter();
			filterNode.type = 'highpass';
			filterNode.frequency.value = hcutoff;
			filterNode.Q.value = 0.1;
			input.connect(filterNode);
			input = filterNode;

			//Resonance@
			filterNode = this.ac.createBiquadFilter();
			this.disconnectOnEnd(filterNode);
			filterNode.type = 'peaking';
			filterNode.frequency.value = hcutoff;
			filterNode.Q.value=70;
			filterNode.gain.value = hresonance*10;
			input.connect(filterNode);

			input.connect(filterNode);
			return filterNode;
	}
	else return input;
}

//Loop effect
//@Calibrate w/ accelerate when accelerate is fully working
//@get duration of buffer before it is loaded?
Graph.prototype.loop = function(input, loopCount){

	if(isNaN(parseInt(loopCount)) || loopCount==0) return input
	//Can't get duration of buffer if isn't loaded yet @
	try{
	var dur = this.source.buffer.duration-(this.begin*this.source.buffer.duration)-((1-this.end)*this.source.buffer.duration);
	this.source.loop=true;
	this.source.loopStart = this.begin*this.source.buffer.duration
	this.source.loopEnd = this.end*this.source.buffer.duration
	this.source.stop(this.when+(dur*loopCount)/this.source.playbackRate.value);
	return input;
	}catch(e){
		console.log("WebDirt Warning: buffer data not yet available to calculate loop time - no looping applied")
		return input
	}
}

Graph.prototype.lowPassFilter = function(input, cutoff, resonance){

	if(cutoff>0 && resonance>0 && resonance<1){
//resonance>0 && resonance<=1 &&
			var filterNode = this.ac.createBiquadFilter();
			this.disconnectOnEnd(filterNode);
			filterNode.type = 'lowpass';
			filterNode.frequency.value = cutoff;
			filterNode.Q.value = resonance

			input.connect(filterNode);
			input = filterNode;

			// filterNode = this.ac.createBiquadFilter();
			// filterNode.type = 'peaking';
			// filterNode.frequency.value = cutoff*14000;
			// filterNode.Q.value=resonance;
			// filterNode.gain.value = resonance*15;
			// input.connect(filterNode);
			return filterNode;
	}
	else return input

}


//Accelerate @negative values aren't quite right
Graph.prototype.accelerate = function(accelerateValue, speed){
	if(isNaN(parseFloat(accelerateValue))) accelerateValue = 0;

	if(accelerateValue!=0){
		accelerateValue=parseFloat(accelerateValue)

		this.source.playbackRate.setValueAtTime(speed, this.when);

		var timeToReverse = Math.abs((this.source.buffer.length*accelerateValue/this.ac.sampleRate+speed)/speed)//Math.abs(speed/(speed-accelerateValue));

		//Approximates the final playback speed arrived at when accelerate is used in Dirt
		//final speed = speed + Frames/(speed+accelerate*frames/samplerate) * accelerate/sampleRate
		var rampValue = speed+(this.source.buffer.length)*(accelerateValue)/(this.ac.sampleRate);

		if(rampValue<0){

			this.source.buffer = this.negativeAccelerateBuffer(this.source.buffer, accelerateValue, speed);
			this.source.playbackRate.linearRampToValueAtTime(0, this.when+timeToReverse);
			this.source.playbackRate.linearRampToValueAtTime(1,this.when+this.source.buffer.duration);
		}
		else{
			try{
				this.source.playbackRate.linearRampToValueAtTime(rampValue,this.when+this.source.buffer.duration);
			}catch(e){
				console.log("WebDirt: Warning, buffer data not loaded, could not apply acclerate effect")
			}
		}
	}
}

Graph.prototype.negativeAccelerateBuffer = function(buffer, accelerateValue, speed){
	var frames = buffer.length;
	var pcmData = new Float32Array(frames);
	var newBuffer = this.ac.createBuffer(buffer.numberOfChannels, buffer.length, this.ac.sampleRate)
	var newChannelData = new Float32Array(frames);
	var zeroFrame = Math.abs(speed/(speed-accelerateValue))*frames//(speed/(speed+this.source.buffer.length*(accelerateValue)/this.ac.sampleRate))/frames;

	zeroFrame = frames*Math.abs((this.source.buffer.length*accelerateValue/this.ac.sampleRate+speed)/speed)/this.source.buffer.duration
	zeroFrame = Math.trunc(zeroFrame)

	for(var channel=0; channel<buffer.numberOfChannels; channel++){
		buffer.copyFromChannel(pcmData,channel,0);
		for(var frame=0; frame<zeroFrame; frame++){
			newChannelData[frame]=pcmData[frame]
		}
		for(var frame=0; frame<(frames-zeroFrame); frame++){
			newChannelData[frame+zeroFrame]=pcmData[zeroFrame-frame]
		}
		newBuffer.copyToChannel(newChannelData,channel,0);
	}
	return newBuffer
}

//Another acclerate function:
//More close to how accelerate is applied in Dirt, less efficient in this context@
Graph.prototype.accel = function(buffer, accelerateValue, speed){
	if(isNaN(parseFloat(accelerateValue))) return buffer;
	accelerateValue = parseFloat(accelerateValue);
	//if buffer data isn't loaded yet, affect isn't applied
	try{var frames = buffer.length;}
	catch(e){
		console.log("WebDirt: Warning, buffer data not loaded, accelerate effect not applied");
		return
	}

	var pcmData = new Float32Array(frames);
	var newBuffer = this.ac.createBuffer(buffer.numberOfChannels, buffer.length, this.ac.sampleRate)
	var newChannelData = new Float32Array(frames);

	for(var channel=0; channel<buffer.numberOfChannels; channel++){
		var startSpeed=speed
		buffer.copyFromChannel(pcmData,channel,0);
		var i=0;

		for(var frame=0;frame<frames; frame=frame+startSpeed){
			newChannelData[i]=pcmData[Math.round(frame)]
			startSpeed = startSpeed+accelerateValue/this.ac.sampleRate
			if (frame<0) break
			i++
		}
		newBuffer.copyToChannel(newChannelData,channel,0);

	}
	return newBuffer;
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

Graph.prototype.shape = function(input, shape){
  shape = parseFloat(shape);
  if(isNaN(shape)) shape = 0;
	if(shape >= 1) shape = 0.999;
  if(shape>0 && this.ac.audioWorklet != null ) {
    var shapeProcessorNode = new AudioWorkletNode(this.ac,'shape-processor');
    shapeProcessorNode.parameters.get('shape').value = shape;
    input.connect(shapeProcessorNode);
    this.disconnectOnEnd(shapeProcessorNode);
    return shapeProcessorNode;
  } else {
    return input;
  }
}


Graph.prototype.stop = function(time){
	//setValueAtTime required so linearRampToValue doesn't start immediately
	this.gain.gain.setValueAtTime(this.gain.gain.value, time)
	this.gain.gain.linearRampToValueAtTime(0,time + 0.02);
}

//Unit
Graph.prototype.unit = function(unit, speed){
	   //  a->accelerate = a->accelerate * a->speed * a->cps; // change rate by 1 per cycle
    // a->speed = sample->info->frames * a->speed * a->cps / samplerate;

    if (unit == 'c')
    	this.source.playbackRate.value = this.source.playbackRate.value*this.source.buffer.duration/cps;
}

//Vowel effect
Graph.prototype.vowel= function (input, vowel){
	if (typeof vowel != 'string') return input;
	vowel = vowel.toLowerCase();
	if (vowel=='a'||vowel=='e'||vowel=='i'||vowel=='o'||vowel=='u'){
			var frequencies,q,gains;
			var makeupGain = this.ac.createGain();
			this.disconnectOnEnd(makeupGain);

			switch (vowel){
				case('a'):
					frequencies= vowelFormant.a.freqs
					q = vowelFormant.a.qs
					gains = vowelFormant.a.amps
					break
				case('e'):
					frequencies= vowelFormant.e.freqs
					q = vowelFormant.e.qs
					gains = vowelFormant.e.amps
					break
				case('i'):
					frequencies= vowelFormant.i.freqs
					q = vowelFormant.i.qs
					gains = vowelFormant.i.amps
					break;
				case('o'):
					frequencies= vowelFormant.o.freqs
					q = vowelFormant.o.qs
					gains = vowelFormant.o.amps
					break;
				case('u'):
					frequencies= vowelFormant.u.freqs
					q = vowelFormant.u.qs
					gains = vowelFormant.u.amps
			}
			for(var i=0; i<5; i++){
				var gain = this.ac.createGain();
				this.disconnectOnEnd(gain);
				gain.gain.value = gains[i];
				var filterNode = this.ac.createBiquadFilter();
				this.disconnectOnEnd(filterNode);
				filterNode.type = 'bandpass';
				filterNode.Q.value=q[i]/8;
				filterNode.frequency.value=frequencies[i];
				input.connect(filterNode);
				filterNode.connect(gain);
				gain.connect(makeupGain);

			}
			//@how much makeup gain to add?
			makeupGain.gain.value=8;
			return makeupGain;
	}
	else return input
}


vowelFormant = {
	a: {freqs:[660, 1120, 2750, 3000,3350],  amps: [1, 0.5012, 0.0708, 0.0631, 0.0126], qs:[80, 90, 120, 130, 140]},
	e: {freqs:[440, 1800, 2700, 3000, 3300], amps: [1, 0.1995, 0.1259, 0.1, 0.1], qs: [70, 80, 100, 120, 120]},
	i: {freqs:[270, 1850, 2900, 3350, 3590], amps: [1, 0.0631, 0.0631, 0.0158, 0.0158], qs:[40, 90, 100, 120, 120]},
	o: {freqs:[430, 820, 2700, 3000, 3300], amps: [1, 0.3162, 0.0501, 0.0794, 0.01995], qs: [40, 80, 100, 120, 120]},
	u: {freqs:[370, 630, 2750, 3000, 3400], amps: [ 1, 0.1, 0.0708, 0.0316, 0.01995], qs: [40, 60, 100, 120, 120]}
}
