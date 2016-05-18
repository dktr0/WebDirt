var OUTPUT_CHANNELS=2;
var vowels={
	a : {frequencies: []},
	e :	{frequencies: [270,2300,3000]},
	i : {frequencies: []},
	o : {frequencies: []},
	u : {frequencies: []}
};

function Graph(msg,ac,sampleBank){
	var last;
	this.source = last = ac.createBufferSource();
	var buffer = sampleBank.getBuffer(msg.sample_name,msg.sample_n);
	//this.revBuffer = reverseBuffer(buffer,ac);
	var channelMerger = ac.createChannelMerger(2);

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

		//Sample reverse
		if(msg.speed>=0) this.source.buffer = buffer;
		else this.source = last =reverseBuffer(buffer,ac);

		//Speed
		if(typeof msg.speed != 'number') msg.speed = 1;
		this.source.playbackRate.value=Math.abs(msg.speed);

		if(typeof msg.accelerate != 'number') msg.accelerate = 0;
		if(msg.accelerate!=0){
			this.source.playbackRate.exponentialRampToValueAtTime(msg.accelerate, this.source.buffer.duration);
		}

		//Distortion Applied
		if(typeof msg.shape != 'number') msg.shape = 0;
		if(msg.shape!=0){
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

			temp = ac.createBiquadFilter()
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
		if (msg.sample_loop>0){
			last.loop=true;
			console.log(last.loop)
			last.connect(ac.destination)
			this.source.start(0)
			return
		}



		msg.coarse=Math.abs(msg.coarse);
		console.log(msg.coarse)
		if(msg.coarse>1){

			this.source = last = decimate(this.source.buffer,msg.coarse,ac);


			// var newAc= new AudioContext();
			// newAc.sampleRate=ac.sampleRate/msg.coarse;
			// last.connect(newAc.destination);
			// last.start(0)


			// //@
			// var offlineAc = new OfflineAudioContext(OUTPUT_CHANNELS,this.source.buffer.length,this.source.buffer.sampleRate/msg.coarse)
			// var resampledBuffer = offlineAc.createBuffer(this.source.buffer.numberOfChannels,this.source.buffer.length,ac.sampleRate);
			// var bufferData = new Float32Array(this.source.buffer.length);
			// this.source.buffer.copyFromChannel(bufferData,0,0);
			// offlineAc.startRendering();

			// this.source = offlineAc.createBufferSource();
			// resampledBuffer.copyToChannel(bufferData,0,0);

			// this.source.buffer = resampledBuffer;
			// this.source.connect(offlineAc.destination);

			// this.source.start(0);

			// return



		}


		//Crush
		if (msg.crush>=1){
			this.source = last = crush(this.source.buffer, msg.crush, ac)
		}

		//Gain
		var gain = ac.createGain()
		if(msg.gain!=null) gain.gain.value= Math.abs(msg.gain);
		else gain.gain.value =1;

		msg.delay=Math.abs(msg.delay);
		//Delay
		if(msg.delay!=0){
			var delay = ac.createDelay();
			delay.delayTime.value = msg.delaytime;
			var delayGain = ac.createGain();
			var feedBackGain = ac.createGain();
			feedBackGain.gain.value= msg.delayfeedback;
			delayGain.gain.value = msg.delay;
			last.connect(gain);
			last.connect(delay);
			delay.connect(delayGain);
			delayGain.connect(last);
			delay.connect(feedBackGain);
			feedBackGain.connect(delay);
		}
		else
			last.connect(gain);

		//	last = temp;
		this.source.start(msg.when,msg.begin*this.source.buffer.duration,msg.end*this.source.buffer.duration);

	}


	//Panning (currently stereo)
//	var channelMerger = ac.createChannelMerger(2);
	// channelMerger.channelCount = 1;
	// channelMerger.channelCountMode = "explicit";
	// channelMerger.channelInterpretation = "discrete";

	channelMerger.connect(ac.destination);
	var gain1 = ac.createGain();
	var gain2 = ac.createGain();
	gain1.gain.value=1-msg.pan;
	gain.connect(gain1);
	gain1.connect(channelMerger,0,0);
	gain2.gain.value=msg.pan;
	gain.connect(gain2);
	gain2.connect(channelMerger,0,1);




	//last.connect(ac.destination);
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


//script processor node -- inefficient..
//pan - gain per channel
//accelerate - playback.(envelope of some kind)
//crush and coarse - more difficutl
//this.source.loop=true;
//distortion - in webaudioapi..

//Returns a new BufferSourceNode containing a buffer with the reversed frames of the
//parameter 'buffer'
//@add add more for multi-channel samples
function reverseBuffer(buffer,ac){
	var frames = buffer.length;
	var pcmData = new Float32Array(frames);
	var newBuffer = ac.createBuffer(buffer.numberOfChannels,buffer.length,ac.sampleRate);
	var source = ac.createBufferSource();
	var newChannelData = new Float32Array(frames);

	buffer.copyFromChannel(pcmData,0,0);
	for (var i =0;i<frames;i++){
		newChannelData[i]=pcmData[frames-i];
	}
	//First element of newChannelData will be set to NaN - causes clipping on first frame
	//set to send element to get rid of clipping
	newChannelData[0]=newChannelData[1];
	newBuffer.copyToChannel(newChannelData,0,0);
	source.buffer = newBuffer;

	return source;
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
