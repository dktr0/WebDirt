
// note: the SampleBank constructor does not take an audio context argument
// however, most SampleBank methods assume/require that a valid audio context is stored in property ac
// so before doing anything with a newly created SampleBank object you should set it's property ac to
// a valid audio context.

SampleBank = function(sampleMapUrl,urlPrefix,readyCallback) {
  this.sampleMapUrl = sampleMapUrl;
  this.urlPrefix = urlPrefix;
  this.samples = {};

  var request = new XMLHttpRequest();
  request.open('GET',this.sampleMapUrl,true);
  request.responseType = "json";
  var closure = this;
  request.onload = function() {
    if(request.readyState != 4) throw Error("readyState != 4 in callback of sampleMap load");
    if(request.status != 200) throw Error("status != 200 in callback of sampleMap load");
    if(request.response == null) throw Error("JSON response null in callback of sampleMap load");
    closure.sampleMap = request.response;
    console.log("sampleMap loaded from " + closure.sampleMapUrl);
    if(typeof readyCallback == 'function')readyCallback();
  };
  request.send();
}

// loads the set of samples with the same name (but different number)
SampleBank.prototype.loadAllNamed = function(name) {
  if(this.ac == null) throw Error("called SampleBank.loadAllNamed with null audio context");
  if(this.sampleMap == null) throw Error("SampleBank.loadAllNamed: sampleMap is null");
  if(this.sampleMap[name] == null) throw Error("SampleBank.loadAllNamed: no sampleMap for " + name);
  for(var n=0;n<this.sampleMap[name].length;n++) this.load(name,n);
}

// loads an individual sample
SampleBank.prototype.load = function(name,number,callbackWhenReady) {
  if(this.ac == null) throw Error("called SampleBank.load with null audio context");
  if(number == null) number = 0;
  if(this.sampleMap == null) throw Error("SampleBank.load: sampleMap is null");
  if(this.sampleMap[name] == null) throw Error("SampleBank.load: no sampleMap for " + name);
  if(number >= this.sampleMap[name].length) throw Error("SampleBank.load: number > number of samples");
  var filename = this.sampleMap[name][number];
  if(this.samples[filename] != null) {
    if(this.samples[filename].status == 'ready') {
        // console.log('warning: already loaded sample ' + name);
        if(typeof callbackWhenReady == 'function') callbackWhenReady();
        return;
    }
    if(this.samples[filename].status == 'loading') {
        // console.log('warning: loading already in progress for sample ' + name);
        if(typeof callbackWhenReady == 'function') callbackWhenReady(); // not sure about this, but for now...
        return;
    }
  }
  this.samples[filename] = { status: 'loading' };
  var url = this.urlPrefix + "/" + filename;
  var request = new XMLHttpRequest();
  try {
    request.open('GET',url,true);
    request.responseType = 'arraybuffer';
    var closure = this; // a closure is necessary for...
    request.onload = function() {
      closure.ac.decodeAudioData(request.response, function(x) {
        console.log("sample " + url + "loaded");
        closure.samples[filename].buffer = x; // ...the decoded data to be kept in the object
        closure.samples[filename].status = 'ready';
        if(typeof callbackWhenReady == 'function') callbackWhenReady();
      },
      function(err) {
        console.log("error decoding sample " + url);
        closure.samples[filename].status = 'error';
      });
    };
    request.send();
  }
  catch(e) {
    console.log("exception during loading of sample " + name + ":" + e);
  }
}

SampleBank.prototype.getBuffer = function(name,number) {
  if(this.ac == null) throw Error("called SampleBank.getBuffer with null audio context");
  if(number == null) number = 0;
  if(this.sampleMap == null) throw Error("SampleBank.getBuffer: sampleMap is null");
  if(this.sampleMap[name] == null) throw Error("SampleBank.getBuffer: no sampleMap for " + name);
  number = number % this.sampleMap[name].length;

  var filename = this.sampleMap[name][number];
  if(this.samples[filename] == null) {
    this.load(name,number);
    console.log("loading sample " + filename + "for the first time");
    return null;
  }
  if(this.samples[filename].status == 'error') {
    console.log("SampleBank.getBuffer: sample " + name + " has status error");
    return null;
  }
  if(this.samples[filename].status == 'loading') {
    console.log("SampleBank.getBuffer: sample" + name + " is still loading");
  }
  return this.samples[filename].buffer;
}
