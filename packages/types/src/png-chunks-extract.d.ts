declare module 'png-chunks-extract' {
  export default function extract(buffer: Uint8Array): { name: string; data: Uint8Array }[];
}