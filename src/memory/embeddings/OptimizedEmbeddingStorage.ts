/**
 * OptimizedEmbeddingStorage implementation
 * Provides memory-efficient storage for vector embeddings with various precision options
 */

/**
 * Types of embedding precision
 */
export type EmbeddingPrecision = 'high' | 'standard' | 'reduced' | 'quantized';

/**
 * Metadata for stored embeddings
 */
export interface EmbeddingMetadata {
  dimensions: number;
  precision: EmbeddingPrecision;
  createdAt: number;
  lastAccessedAt: number;
  source?: string;
  modelName?: string;
  sizeBytes: number;
}

/**
 * Options for embedding quantization
 */
export interface QuantizationOptions {
  /**
   * Quantization method
   * @default 'minmax'
   */
  method?: 'minmax' | 'centered' | 'logarithmic';
  
  /**
   * Whether to store normalization parameters for dequantization
   * @default true
   */
  storeParams?: boolean;
}

/**
 * Options for configuring OptimizedEmbeddingStorage
 */
export interface OptimizedEmbeddingStorageOptions {
  /**
   * Default precision for embeddings if not specified during storage
   * @default 'standard'
   */
  defaultPrecision?: EmbeddingPrecision;
  
  /**
   * Whether to normalize vectors by default (unit vectors)
   * @default false
   */
  normalize?: boolean;
  
  /**
   * Maximum dimensions for embeddings (helps pre-allocate memory efficiently)
   * @default 1536 (typical for large language models)
   */
  maxDimensions?: number;
  
  /**
   * Options for quantization when 'quantized' precision is used
   */
  quantizationOptions?: QuantizationOptions;
  
  /**
   * Whether to track memory usage statistics
   * @default true
   */
  trackStats?: boolean;
}

/**
 * Parameters for quantized embeddings
 */
interface QuantizationParams {
  min: number;
  max: number;
  scale: number;
  offset: number;
}

/**
 * Stored embedding with metadata and quantization parameters
 */
interface StoredEmbedding {
  data: Float32Array | Float64Array | Int8Array | Uint8Array;
  metadata: EmbeddingMetadata;
  quantParams?: QuantizationParams;
}

/**
 * OptimizedEmbeddingStorage class
 * Provides highly memory-efficient storage for vector embeddings
 * with support for various precision levels and quantization
 */
export class OptimizedEmbeddingStorage {
  // Storage maps for different precision levels
  private float32Embeddings = new Map<string, StoredEmbedding>();
  private float64Embeddings = new Map<string, StoredEmbedding>();
  private quantizedEmbeddings = new Map<string, StoredEmbedding>();
  
  // Configuration
  private defaultPrecision: EmbeddingPrecision;
  private normalize: boolean;
  private maxDimensions: number;
  private quantizationOptions: Required<QuantizationOptions>;
  private trackStats: boolean;
  
  // Memory usage statistics
  private stats = {
    totalEmbeddings: 0,
    totalMemoryBytes: 0,
    byPrecision: {
      high: { count: 0, bytes: 0 },
      standard: { count: 0, bytes: 0 },
      reduced: { count: 0, bytes: 0 },
      quantized: { count: 0, bytes: 0 }
    },
    memoryReduction: 0, // Percentage of memory saved compared to all Float64
    retrievals: 0,
    stores: 0
  };
  
  constructor(options: OptimizedEmbeddingStorageOptions = {}) {
    this.defaultPrecision = options.defaultPrecision ?? 'standard';
    this.normalize = options.normalize ?? false;
    this.maxDimensions = options.maxDimensions ?? 1536;
    this.quantizationOptions = {
      method: options.quantizationOptions?.method ?? 'minmax',
      storeParams: options.quantizationOptions?.storeParams ?? true
    };
    this.trackStats = options.trackStats ?? true;
  }
  
  /**
   * Store an embedding with specified precision
   */
  storeEmbedding(
    id: string,
    embedding: number[],
    precision?: EmbeddingPrecision,
    metadata: Partial<Omit<EmbeddingMetadata, 'dimensions' | 'precision' | 'createdAt' | 'lastAccessedAt' | 'sizeBytes'>> = {}
  ): void {
    // Use default precision if not specified
    const targetPrecision = precision ?? this.defaultPrecision;
    const dimensions = embedding.length;
    
    // Normalize if requested (create unit vectors)
    let processedEmbedding = this.normalize ? this.normalizeVector(embedding) : embedding;
    
    // Store with appropriate precision
    let data: Float32Array | Float64Array | Int8Array | Uint8Array;
    let quantParams: QuantizationParams | undefined;
    let sizeBytes: number;
    
    switch (targetPrecision) {
      case 'high':
        // 64-bit float for highest precision
        data = new Float64Array(processedEmbedding);
        sizeBytes = data.byteLength;
        this.float64Embeddings.set(id, { data, metadata: this.createMetadata(targetPrecision, dimensions, sizeBytes, metadata) });
        break;
        
      case 'standard':
        // 32-bit float for standard precision (good balance of precision and memory)
        data = new Float32Array(processedEmbedding);
        sizeBytes = data.byteLength;
        this.float32Embeddings.set(id, { data, metadata: this.createMetadata(targetPrecision, dimensions, sizeBytes, metadata) });
        break;
        
      case 'reduced':
        // 16-bit half float equivalent by storing as 32-bit but reducing precision
        // We'll use Float32Array but intentionally reduce precision
        data = this.reduceFloat32Precision(processedEmbedding);
        sizeBytes = data.byteLength;
        this.float32Embeddings.set(id, { data, metadata: this.createMetadata(targetPrecision, dimensions, sizeBytes, metadata) });
        break;
        
      case 'quantized':
        // 8-bit integer quantization for maximum memory savings
        const { quantized, params } = this.quantizeVector(processedEmbedding, this.quantizationOptions.method);
        data = quantized;
        quantParams = params;
        sizeBytes = data.byteLength + (quantParams ? 32 : 0); // Approximate size of quantParams
        this.quantizedEmbeddings.set(id, {
          data,
          metadata: this.createMetadata(targetPrecision, dimensions, sizeBytes, metadata),
          quantParams
        });
        break;
    }
    
    // Update statistics
    if (this.trackStats) {
      this.stats.totalEmbeddings++;
      this.stats.totalMemoryBytes += sizeBytes;
      this.stats.byPrecision[targetPrecision].count++;
      this.stats.byPrecision[targetPrecision].bytes += sizeBytes;
      this.stats.stores++;
      
      // Calculate memory reduction compared to storing all as Float64
      const float64Size = dimensions * 8; // 8 bytes per number in Float64
      this.stats.memoryReduction = 100 * (1 - this.stats.totalMemoryBytes / (this.stats.totalEmbeddings * float64Size));
    }
  }
  
  /**
   * Retrieve an embedding by ID
   */
  getEmbedding(id: string): number[] | null {
    // Check in each storage by precision level
    let storedEmbedding = this.float32Embeddings.get(id) || 
                           this.float64Embeddings.get(id) || 
                           this.quantizedEmbeddings.get(id);
    
    if (!storedEmbedding) {
      return null;
    }
    
    // Update access time
    storedEmbedding.metadata.lastAccessedAt = Date.now();
    
    // Track statistics
    if (this.trackStats) {
      this.stats.retrievals++;
    }
    
    // Convert to standard number array based on storage type
    if (storedEmbedding.data instanceof Float32Array || storedEmbedding.data instanceof Float64Array) {
      return Array.from(storedEmbedding.data);
    } else if (storedEmbedding.quantParams) {
      // Dequantize if needed
      return this.dequantizeVector(storedEmbedding.data as Uint8Array | Int8Array, storedEmbedding.quantParams);
    }
    
    // Fallback (should never happen with proper typing)
    return Array.from(storedEmbedding.data);
  }
  
  /**
   * Get embedding metadata without loading the full embedding
   */
  getEmbeddingMetadata(id: string): EmbeddingMetadata | null {
    // Check in each storage by precision level
    const storedEmbedding = this.float32Embeddings.get(id) || 
                           this.float64Embeddings.get(id) || 
                           this.quantizedEmbeddings.get(id);
    
    return storedEmbedding?.metadata || null;
  }
  
  /**
   * Get typed array directly (for efficient similarity calculations)
   */
  getEmbeddingArray(id: string): Float32Array | Float64Array | null {
    // Check in high precision storage first
    let storedEmbedding = this.float64Embeddings.get(id);
    if (storedEmbedding) {
      storedEmbedding.metadata.lastAccessedAt = Date.now();
      if (this.trackStats) this.stats.retrievals++;
      return storedEmbedding.data as Float64Array;
    }
    
    // Check in standard precision storage
    storedEmbedding = this.float32Embeddings.get(id);
    if (storedEmbedding) {
      storedEmbedding.metadata.lastAccessedAt = Date.now();
      if (this.trackStats) this.stats.retrievals++;
      return storedEmbedding.data as Float32Array;
    }
    
    // Check in quantized storage and convert if found
    storedEmbedding = this.quantizedEmbeddings.get(id);
    if (storedEmbedding && storedEmbedding.quantParams) {
      storedEmbedding.metadata.lastAccessedAt = Date.now();
      if (this.trackStats) this.stats.retrievals++;
      
      // Dequantize to Float32Array
      const dequantized = this.dequantizeVector(
        storedEmbedding.data as Uint8Array | Int8Array,
        storedEmbedding.quantParams
      );
      
      return new Float32Array(dequantized);
    }
    
    return null;
  }
  
  /**
   * Remove an embedding from storage
   */
  removeEmbedding(id: string): boolean {
    let removed = false;
    
    // Check each storage type
    if (this.float32Embeddings.has(id)) {
      const item = this.float32Embeddings.get(id)!;
      if (this.trackStats) {
        this.stats.totalEmbeddings--;
        this.stats.totalMemoryBytes -= item.metadata.sizeBytes;
        this.stats.byPrecision[item.metadata.precision].count--;
        this.stats.byPrecision[item.metadata.precision].bytes -= item.metadata.sizeBytes;
      }
      this.float32Embeddings.delete(id);
      removed = true;
    }
    
    if (this.float64Embeddings.has(id)) {
      const item = this.float64Embeddings.get(id)!;
      if (this.trackStats) {
        this.stats.totalEmbeddings--;
        this.stats.totalMemoryBytes -= item.metadata.sizeBytes;
        this.stats.byPrecision[item.metadata.precision].count--;
        this.stats.byPrecision[item.metadata.precision].bytes -= item.metadata.sizeBytes;
      }
      this.float64Embeddings.delete(id);
      removed = true;
    }
    
    if (this.quantizedEmbeddings.has(id)) {
      const item = this.quantizedEmbeddings.get(id)!;
      if (this.trackStats) {
        this.stats.totalEmbeddings--;
        this.stats.totalMemoryBytes -= item.metadata.sizeBytes;
        this.stats.byPrecision[item.metadata.precision].count--;
        this.stats.byPrecision[item.metadata.precision].bytes -= item.metadata.sizeBytes;
      }
      this.quantizedEmbeddings.delete(id);
      removed = true;
    }
    
    return removed;
  }
  
  /**
   * Clear all embeddings from storage
   */
  clear(): void {
    this.float32Embeddings.clear();
    this.float64Embeddings.clear();
    this.quantizedEmbeddings.clear();
    
    if (this.trackStats) {
      this.stats = {
        totalEmbeddings: 0,
        totalMemoryBytes: 0,
        byPrecision: {
          high: { count: 0, bytes: 0 },
          standard: { count: 0, bytes: 0 },
          reduced: { count: 0, bytes: 0 },
          quantized: { count: 0, bytes: 0 }
        },
        memoryReduction: 0,
        retrievals: 0,
        stores: 0
      };
    }
  }
  
  /**
   * Get storage statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  /**
   * Check if an embedding exists
   */
  hasEmbedding(id: string): boolean {
    return (
      this.float32Embeddings.has(id) ||
      this.float64Embeddings.has(id) ||
      this.quantizedEmbeddings.has(id)
    );
  }
  
  /**
   * Get all embedding IDs
   */
  getEmbeddingIds(): string[] {
    const ids = new Set<string>();
    
    for (const id of this.float32Embeddings.keys()) ids.add(id);
    for (const id of this.float64Embeddings.keys()) ids.add(id);
    for (const id of this.quantizedEmbeddings.keys()) ids.add(id);
    
    return Array.from(ids);
  }
  
  /**
   * Calculate vector similarity (cosine similarity)
   * Optimized to work directly with stored embeddings
   */
  calculateSimilarity(id1: string, id2: string): number | null {
    const vec1 = this.getEmbeddingArray(id1);
    const vec2 = this.getEmbeddingArray(id2);
    
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return null;
    }
    
    return this.cosineSimilarity(vec1, vec2);
  }
  
  /**
   * Create embedding metadata
   */
  private createMetadata(
    precision: EmbeddingPrecision,
    dimensions: number,
    sizeBytes: number,
    customMetadata: Partial<EmbeddingMetadata> = {}
  ): EmbeddingMetadata {
    return {
      dimensions,
      precision,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      sizeBytes,
      ...customMetadata
    };
  }
  
  /**
   * Normalize a vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude === 0) {
      return vector; // Can't normalize a zero vector
    }
    
    return vector.map(val => val / magnitude);
  }
  
  /**
   * Reduce precision of float32 values to simulate 16-bit storage
   */
  private reduceFloat32Precision(vector: number[]): Float32Array {
    const result = new Float32Array(vector.length);
    
    // Simulate 16-bit precision by truncating mantissa bits
    for (let i = 0; i < vector.length; i++) {
      // Convert to binary representation and back with reduced precision
      const truncated = Math.fround(vector[i]); // This forces 32-bit precision first
      
      // Further reduce by truncating least significant bits
      // This simulates 16-bit float behavior while still using 32-bit storage
      const factor = 1 << 13; // 2^13, roughly simulating 16-bit precision
      result[i] = Math.round(truncated * factor) / factor;
    }
    
    return result;
  }
  
  /**
   * Quantize a vector to 8-bit integers
   */
  private quantizeVector(vector: number[], method: 'minmax' | 'centered' | 'logarithmic'): {
    quantized: Uint8Array | Int8Array;
    params: QuantizationParams;
  } {
    let quantized: Uint8Array | Int8Array;
    let params: QuantizationParams;
    
    switch (method) {
      case 'minmax': {
        // Find min and max values
        const min = Math.min(...vector);
        const max = Math.max(...vector);
        const range = max - min;
        
        // Avoid division by zero
        const scale = range > 0 ? 255 / range : 1;
        
        // Convert to 0-255 range (uint8)
        quantized = new Uint8Array(vector.length);
        for (let i = 0; i < vector.length; i++) {
          quantized[i] = Math.round((vector[i] - min) * scale);
        }
        
        params = { min, max, scale, offset: min };
        break;
      }
      
      case 'centered': {
        // Center around zero, use signed integers (-128 to 127)
        const absMax = Math.max(...vector.map(Math.abs));
        const scale = absMax > 0 ? 127 / absMax : 1;
        
        quantized = new Int8Array(vector.length);
        for (let i = 0; i < vector.length; i++) {
          quantized[i] = Math.max(-128, Math.min(127, Math.round(vector[i] * scale)));
        }
        
        params = { min: -absMax, max: absMax, scale, offset: 0 };
        break;
      }
      
      case 'logarithmic': {
        // Logarithmic quantization for values with logarithmic distribution
        const epsilon = 1e-6; // Small value to avoid log(0)
        const absValues = vector.map(v => Math.abs(v) + epsilon);
        const logValues = absValues.map(Math.log);
        const minLog = Math.min(...logValues);
        const maxLog = Math.max(...logValues);
        const logRange = maxLog - minLog;
        const scale = logRange > 0 ? 255 / logRange : 1;
        
        // Use 8 bits, preserving sign in a separate bit
        quantized = new Uint8Array(vector.length);
        for (let i = 0; i < vector.length; i++) {
          const sign = vector[i] < 0 ? 1 : 0;
          const logVal = Math.log(absValues[i]);
          const quantizedVal = Math.round((logVal - minLog) * scale);
          // Use highest bit for sign and remaining 7 bits for magnitude
          quantized[i] = (sign << 7) | (quantizedVal & 0x7F);
        }
        
        params = { min: minLog, max: maxLog, scale, offset: 0 };
        break;
      }
      
      default:
        // Default to minmax
        return this.quantizeVector(vector, 'minmax');
    }
    
    return { quantized, params };
  }
  
  /**
   * Dequantize a vector from 8-bit integers back to floating point
   */
  private dequantizeVector(quantized: Uint8Array | Int8Array, params: QuantizationParams): number[] {
    const { min, max, scale, offset } = params;
    const result = new Array(quantized.length);
    
    if (quantized instanceof Uint8Array) {
      // Check if this is a logarithmic encoding by checking if min is very small
      const isLog = Math.abs(min) < 1e-5 && scale > 1;
      
      if (isLog) {
        // This is likely logarithmic quantization
        for (let i = 0; i < quantized.length; i++) {
          const val = quantized[i];
          const sign = (val & 0x80) ? -1 : 1;
          const magnitude = val & 0x7F;
          const logVal = (magnitude / scale) + min;
          result[i] = sign * Math.exp(logVal);
        }
      } else {
        // Standard minmax quantization
        for (let i = 0; i < quantized.length; i++) {
          result[i] = (quantized[i] / scale) + offset;
        }
      }
    } else {
      // Int8Array (centered quantization)
      for (let i = 0; i < quantized.length; i++) {
        result[i] = quantized[i] / scale;
      }
    }
    
    return result;
  }
  
  /**
   * Calculate cosine similarity between two vectors
   * Optimized implementation for TypedArrays
   */
  private cosineSimilarity(vec1: Float32Array | Float64Array, vec2: Float32Array | Float64Array): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimensions');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    // Single loop implementation for better performance
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    // Handle zero vectors
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}
