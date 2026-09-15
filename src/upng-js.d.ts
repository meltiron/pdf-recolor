declare module '@upng/upng-js' {
  type BufferLike = ArrayBuffer | SharedArrayBuffer;

  const UPNG: {
    encode(
      images: BufferLike[],
      width: number,
      height: number,
      colorCount: number,
      delays?: number[],
    ): ArrayBuffer;
  };

  export default UPNG;
}
