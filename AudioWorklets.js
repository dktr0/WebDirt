class CoarseProcessor extends AudioWorkletProcessor {

  static get parameterDescriptors() {
    return [{name: 'coarse',defaultValue: 1}];
  }

  constructor() {
    super();
  }

  process(inputs,outputs,parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const coarse = parameters.coarse;
    output[0][0] = input[0][0];
    for(let i = 1; i < input[0].length; ++i) {
      if(i % coarse == 0) output[0][i] = input[0][i];
      else output[0][i] = output[0][i-1];    
    }
    return true;
  }
}

registerProcessor('coarse-processor',CoarseProcessor);

