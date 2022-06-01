// output/WebDirt/foreign.js
var newWebDirt = (args) => () => new WebDirt.WebDirt(args);
var initializeWebAudio = (wd) => () => wd.initializeWebAudio();
var playSample = (wd) => (msg) => () => wd.playSample(msg);

// output/Main/index.js
var makeSoundBackwards = function(wd) {
  return playSample(wd)({
    s: "arpy",
    note: 0,
    speed: -1 | 0
  });
};
var makeSound7 = function(wd) {
  return playSample(wd)({
    s: "arpy",
    note: 7
  });
};
var makeSound4 = function(wd) {
  return playSample(wd)({
    s: "arpy",
    note: 4
  });
};
var makeSound0 = function(wd) {
  return playSample(wd)({
    s: "arpy",
    note: 0
  });
};
var launch = function __do() {
  var wd = newWebDirt({
    sampleMapUrl: "samples/sampleMap.json",
    sampleFolder: "samples"
  })();
  initializeWebAudio(wd)();
  return wd;
};
export {
  launch,
  makeSound0,
  makeSound4,
  makeSound7,
  makeSoundBackwards
};
