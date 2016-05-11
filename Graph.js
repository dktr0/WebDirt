



function queue(msg){


	if(msg.when==null){
		throw Error ("Sample given no 'when' parameter");
	}


	try{

	var graph = new Graph(msg);
	
	} catch (e){
		alert(e.stack);
	}



}



function Graph(msg){
	
	this.sample_name=msg.sample_name;
	this.when= msg.when;
	//alert(ac);
	this.source = webDirt.ac.createBufferSource();


	this.source.buffer = webDirt.sampleBank.getBuffer(this.sample_name);
	
	if(this.source.buffer==null){
		console.log("Unable to load - node killed");

		return 0;
	}
	else{
		alert("loaded");
	}

}









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






