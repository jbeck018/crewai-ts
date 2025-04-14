declare module '@xenova/transformers' {
  export class AutoTokenizer {
    static from_pretrained(model: string): Promise<AutoTokenizer>;
    
    encode(text: string, options?: {
      padding?: boolean;
      truncation?: boolean;
      max_length?: number;
      return_tensors?: 'pt';
    }): Promise<{
      input_ids: Tensor;
      attention_mask: Tensor;
      [key: string]: any;
    }>;
  }

  export class AutoModel {
    static from_pretrained(model: string): Promise<AutoModel>;
    
    forward(inputs: any): Promise<{
      last_hidden_state: Tensor;
      [key: string]: any;
    }>;
  }

  export class Tensor {
    unsqueeze(dim: number): Tensor;
    expand(shape: number[]): Tensor;
    mul(other: Tensor): Tensor;
    sum(dim: number): Tensor;
    div(other: Tensor): Tensor;
    data: number[];
    shape: number[];
    slice(dim: number, start: number, end: number): Tensor;
  }
}
