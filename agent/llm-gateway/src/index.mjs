export class ModelProvider {
  async generateStructured() { throw new Error('Model provider is not configured'); }
}

export class MockModelProvider extends ModelProvider {
  async generateStructured() { return { provider: 'mock', output: null }; }
}
