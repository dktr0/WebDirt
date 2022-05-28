// note: the SampleBank constructor does not take an audio context argument
// however, most SampleBank methods assume/require that a valid audio context is stored in property ac
// so before doing anything with a newly created SampleBank object you should set it's property ac to
// a valid audio context.

export default function SampleBank(sampleMapUrl,urlPrefix,readyCallback) {
  this.STATUS_PRELOAD = 0;
  this.STATUS_LOADING = 1;
  this.STATUS_READY = 2;
  this.STATUS_ERROR = 3;
  this.sampleMapUrl = sampleMapUrl;
  this.urlPrefix = urlPrefix;
  this.samples = {};

  var request = new XMLHttpRequest();
  request.open('GET',this.sampleMapUrl,true);
  request.responseType = "json";
  var closure = this;
  request.onload = function() {
    if(request.readyState != 4) throw Error("WebDirt: readyState != 4 in callback of sampleMap load");
    if(request.status != 200) throw Error("WebDirt: status != 200 in callback of sampleMap load");
    if(request.response == null) throw Error("WebDirt: JSON response null in callback of sampleMap load");
    closure.sampleMap = request.response;
    console.log("WebDirt: sampleMap loaded from " + closure.sampleMapUrl);
    if(typeof readyCallback == 'function')readyCallback();
  };
  request.onerror = function() {
    console.log("WebDirt: unspecified error in loading of sampleMap from " + closure.sampleMapUrl);
  }
  request.send();
}


// loads the set of samples with the same name (but different number)
SampleBank.prototype.loadAllNamed = function(name) {
  if(this.ac == null) throw Error("WebDirt: called SampleBank.loadAllNamed with null audio context");
  if(this.sampleMap == null) throw Error("WebDirt: SampleBank.loadAllNamed: sampleMap is null");
  if(this.sampleMap[name] == null ) {
    console.log("WebDirt: can't loadAllNamed " + name + " (not present in sampleMap)");
    return;
  }
  for(var n=0;n<this.sampleMap[name].length;n++) this.load(this.getFilename(name,n));
}


// loads an individual sample
SampleBank.prototype.load = function(filename,callbackWhenReady) {
  if(this.samples[filename] == null) {
    this.samples[filename] = {};
    this.samples[filename].status = this.STATUS_PRELOAD;
  }
  if(this.samples[filename].status == this.STATUS_READY) {
    if(typeof callbackWhenReady == 'function') callbackWhenReady();
    return;
  }
  // silently ignore re-requests for samples that produced an error, or are still loading
  if(this.samples[filename].status == this.STATUS_ERROR) return;
  if(this.samples[filename].status == this.STATUS_LOADING) return;
  // if we get this far, we are going to attempt to load the requested file...
  this.samples[filename].status = this.STATUS_LOADING;
  var url = this.urlPrefix + "/" + filename;
  var request = new XMLHttpRequest();
  try {
    request.open('GET',url,true);
    request.responseType = 'arraybuffer';
    var closure = this;
    request.onload = function() {
      closure.ac.decodeAudioData(request.response, function(x) {
        closure.samples[filename].buffer = x;
        closure.samples[filename].status = closure.STATUS_READY;
        if(typeof callbackWhenReady == 'function') callbackWhenReady();
      },
      function(err) {
        console.log("WebDirt: error decoding " + url);
        closure.samples[filename].status = closure.STATUS_ERROR;
      });
    };
    request.onerror = function() {
      console.log("WebDirt: error requesting " + url);
      closure.samples[filename].status = closure.STATUS_ERROR;

    };
    request.send();
  }
  catch(e) {
    console.log("WebDirt: exception loading " + url + " = " + e);
    closure.samples[filename].status = closure.STATUS_ERROR;
  }
}


SampleBank.prototype.sampleNameExists = function(name) {
  if(this.sampleMap == null) {
    console.log("WebDirt: can't lookup sample bank because sampleMap doesn't exist");
    return false;
  }
  if(this.sampleMap[name] == null) return false;
  return true;
}


// note: will throw exception if sample map doesn't exist, or sample name not in sample map
SampleBank.prototype.getFilename = function(name,number) {
  if(number == null) number = 0;
  if(number < 0) number = this.sampleMap[name].length - (Math.abs(number) % this.sampleMap[name].length);
  number = number % this.sampleMap[name].length;
  return this.sampleMap[name][number];
}

// note: will throw exception if sample map doesn't exist, or sample name not in sample map
SampleBank.prototype.getBufferMightSucceed = function(name,number) {
  var filename = this.getFilename(name,number);
  if(this.samples[filename] == null) return true; // hasn't been attempted before, so might succeed
  if(this.samples[filename].status == this.STATUS_PRELOAD) return false; // why didn't we get to LOADING? must be a problem
  if(this.samples[filename].status == this.STATUS_LOADING) return true;
  if(this.samples[filename].status == this.STATUS_READY) return true;
  if(this.samples[filename].status == this.STATUS_ERROR) return false;
  throw Error("WebDirt: SampleBank.getBufferMightSucceed: unrecognized status for " + name + ":" + number);
}


SampleBank.prototype.getBuffer = function(name,number) {
  var filename = this.getFilename(name,number);
  if(this.samples[filename] == null) {
    this.load(filename);
    return null;
  }
  if(this.samples[filename].status == this.STATUS_PRELOAD) {
    console.log("WebDirt: *strange error* in SampleBank.getBuffer: sample " + name + ":" + number + " status is PRELOAD");
    return null;
  }
  if(this.samples[filename].status == this.STATUS_ERROR) {
    console.log("WebDirt: SampleBank.getBuffer: sample " + name + " has status error");
    return null;
  }
  if(this.samples[filename].status == this.STATUS_LOADING) {
    console.log("WebDirt: SampleBank.getBuffer: " + name + ":" + number + " is still loading");
    return null;
  }
  if(this.samples[filename].status == this.STATUS_READY) {
    return this.samples[filename].buffer;
  }
  console.log("WebDirt: *strange error* in SampleBank.getBuffer: sample " + name + ":" + number + " has unknown status");
  return null;
}


SampleBank.prototype.getReverseBuffer = function(name,number) {
  if(this.sampleMap[name] == null) {
    console.log("WebDirt: can't getReverseBuffer " + name + " (not present in sampleMap)");
    return;
  }
  var filename = this.getFilename(name,number);
  if(this.samples[filename] != null) {
    // if we already have a cached reverse buffer, return that
    if(this.samples[filename].reverseBuffer != null) {
      return this.samples[filename].reverseBuffer;
    }
    // if we have a cached "forward" buffer, use that to make, cache, and return a reversed buffer
    if(this.samples[filename].status == this.STATUS_READY) {
      this.samples[filename].reverseBuffer = reverseBuffer(this.ac,this.samples[filename].buffer);
      return this.samples[filename].reverseBuffer;
    }
  }
  // in all other cases, we don't have any cached buffer to work with, so load one
  this.load(filename);
  return null;
}

function reverseBuffer(ac,buffer) {
  var frames = buffer.length;
  var pcmData = new Float32Array(frames);
  var newBuffer = ac.createBuffer(buffer.numberOfChannels,buffer.length,ac.sampleRate);
  var newChannelData = new Float32Array(frames);
  for(var channel=0; channel<buffer.numberOfChannels; channel++) {
    buffer.copyFromChannel(pcmData,channel,0);
    for (var i =0;i<frames;i++) newChannelData[i]=pcmData[frames-i];
    // First element of newChannelData will be set to NaN - causes clipping on first frame
    // set to second element to get rid of clipping
    newChannelData[0]=newChannelData[1];
    newBuffer.copyToChannel(newChannelData,channel,0);
  }
  return newBuffer;
}
