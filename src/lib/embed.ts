import { Ollama } from 'ollama'

const ollama = new Ollama({ host: process.env.OLLAMA_HOST ?? 'http://localhost:11434' })
const MODEL = process.env.EMBEDDING_MODEL ?? 'nomic-embed-text'

export async function embed(input: string): Promise<number[]> {
  const { embeddings } = await ollama.embed({ model: MODEL, input })
  if (!embeddings[0]) throw new Error('ollama returned no embedding')
  return embeddings[0]
}

export async function embedBatch(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return []
  const { embeddings } = await ollama.embed({ model: MODEL, input: inputs })
  return embeddings
}
