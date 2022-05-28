"use strict";

export const newWebDirt = args => () => new WebDirt.WebDirt(args);

export const initializeWebAudio = wd => () => wd.initializeWebAudio();

export const playSample = wd => msg => () => wd.playSample(msg);

export const sampleHint = wd => bankName => () => wd.sampleHint(bankName);
