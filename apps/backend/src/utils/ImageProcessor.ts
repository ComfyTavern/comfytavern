/**
 * 图像处理工具类
 */
export class ImageProcessor {
  /**
   * 将图像数据编码为base64字符串
   * @param imageData 图像数据
   * @returns Promise<string> base64编码的图像数据
   */
  static async encodeImage(imageData: any): Promise<string> {
    try {
      // 如果已经是base64字符串，直接返回
      if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
        return imageData.split(',')[1];
      }

      // 如果是Buffer，转换为base64
      if (Buffer.isBuffer(imageData)) {
        return imageData.toString('base64');
      }

      // 如果是Uint8Array，转换为Buffer再转base64
      if (imageData instanceof Uint8Array) {
        return Buffer.from(imageData).toString('base64');
      }

      throw new Error('Unsupported image data format');
    } catch (error) {
      throw new Error(`Image encoding failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}