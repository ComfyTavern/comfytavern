declare module 'png-chunk-text' {
  interface TextChunk {
    keyword: string;
    text: string;
  }

  interface PNGtext {
    decode(data: Uint8Array): TextChunk;
    encode(keyword: string, text: string): { name: string; data: Uint8Array };
  }

  const pngText: PNGtext;
  export default pngText;
}