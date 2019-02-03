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


class CrushProcessor extends AudioWorkletProcessor {

  static get parameterDescriptors() {
    return [{name: 'crush',defaultValue: 0}];
  }

  constructor() {
    super();
  }

  process(inputs,outputs,parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const crush = parameters.crush;
    for(let i = 0; i < input[0].length; ++i) {
      output[0][i]=Math.round(input[0][i]*Math.pow(2,(crush-1)))/Math.pow(2,(crush-1));
    }
    return true;
  }
}

registerProcessor('crush-processor',CrushProcessor);


class ShapeProcessor extends AudioWorkletProcessor {

  static get parameterDescriptors() {
    return [{name: 'shape',defaultValue: 0}];
  }

  constructor() {
    super();
  }

  process(inputs,outputs,parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const shape0 = parameters.shape;
    const shape1 = shape0 < 1 ? shape0 : (1.0 - 4e-10);
    const shape = (2.0 * shape1) / (1.0 - shape1);
    for(let i = 0; i < input[0].length; ++i) {
      output[0][i]=(1+shape)*input[0][i]/(1+(shape*Math.abs(input[0][i])));
    }
    return true;
  }
}

registerProcessor('shape-processor',ShapeProcessor);

