"use strict";

exports._newWebDirt = args => () => new WebDirt.WebDirt(args);

exports.initializeWebAudio = wd => () => wd.initializeWebAudio();

exports._playSample = wd => msg => () => wd.playSample(msg);

exports.sampleHint = wd => bankName => () => wd.sampleHint(bankName);
