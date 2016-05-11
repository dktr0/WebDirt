
SampleBank = function(urlPrefix) {
  this.urlPrefix = urlPrefix;
  this.samples = {};
}

SampleBank.prototype.load = function(name) {
  if(this.samples[name] != null) {
    if(this.samples[name].status == 'ready') {
        console.log('warning: already loaded sample ' + name);
        return;
    }
    if(this.samples[name].status == 'loading') {
        console.log('warning: loading already in progress for sample ' + name);
        return;
    }
  }
  this.samples[name] = { status: 'loading' };
  var url = this.urlPrefix + "/" + name;
  var request = new XMLHttpRequest();
  request.open('GET',url,true);
  request.responseType = 'arraybuffer';
  var closure = this; // a closure is necessary for...
  request.onload = function() {
      ac.decodeAudioData(request.response, function(x) {
        console.log("sample " + url + "loaded");
        closure.samples[name].buffer = x; // ...the decoded data to be kept in the object
        closure.samples[name].status = 'ready';
      },
      function(err) {
        console.log("error decoding sample " + url);
        closure.samples[name].status = 'error';
      });
  };
  request.send();
}

SampleBank.prototype.getBuffer = function(name) {
  if(this.samples[name] == null) {
    console.log("SampleBank.getBuffer: sample " + name + "doesn't exist");
    return null;
  }
  if(this.samples[name].status == 'error') {
    console.log("SampleBank.getBuffer: sample " + name + " has status error");
    return null;
  }
  if(this.samples[name].status == 'loading') {
    console.log("SampleBank.getBuffer: sample" + name + " is still loading");
  }
  return samples[name].buffer;
}
