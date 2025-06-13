import { useApi } from '@/utils/api';

interface UpdateUsernamePayload {
  username: string;
}

interface UpdateUsernameResponse {
  success: boolean;
  message: string;
  username?: string; // 返回更新后的用户名
}

/**
 * 更新当前默认用户的用户名。
 * @param payload 包含新用户名的对象。
 * @returns 解析为包含成功状态和消息的对象的 Promise。
 */
export async function updateDefaultUsername(payload: UpdateUsernamePayload): Promise<UpdateUsernameResponse> {
  const { put } = useApi();
  try {
    // put<UpdateUsernameResponse> 指定了期望的响应体类型
    const responseData = await put<UpdateUsernameResponse>('/users/me/username', payload);
    return responseData; // useApi 的 put 已经处理了 response.data
  } catch (error: any) {
    console.error('更新用户名失败:', error);
    // 尝试从 error 对象中提取后端返回的错误信息
    if (error && error.data && typeof error.data.error === 'string') {
      throw { success: false, message: error.data.error, ...(error.data.details && { details: error.data.details }) };
    }
    if (error && typeof error.message === 'string' && !error.data) { // AxiosError without data but with message
        throw { success: false, message: error.message };
    }
    throw { success: false, message: '更新用户名时发生未知网络错误' };
  }
}

interface UploadAvatarResponse {
  success: boolean;
  message: string;
  avatarUrl?: string;
}

/**
 * 上传用户头像文件。
 * @param file 要上传的头像文件。
 * @returns 解析为包含成功状态、消息和新头像 URL 的对象的 Promise。
 */
export async function uploadAvatar(originalFile: File): Promise<UploadAvatarResponse> {
  const { post } = useApi();
  const formData = new FormData();

  // 提取原始扩展名
  const originalName = originalFile.name;
  // 安全地获取扩展名，即使文件名中没有点，也提供默认值
  const lastDotIndex = originalName.lastIndexOf('.');
  const extension = (lastDotIndex > -1 && lastDotIndex < originalName.length - 1)
                  ? originalName.substring(lastDotIndex + 1).toLowerCase()
                  : 'jpg'; // 如果没有扩展名或点在最后，默认为 'jpg'

  // 创建一个简化的、URL安全的文件名
  const simplifiedFilename = `avatar.${extension}`;

  // 使用简化的文件名附加到 FormData
  // 第三个参数 filename 用于在 Content-Disposition 中指定文件名
  formData.append('avatar', originalFile, simplifiedFilename);

  console.log(
    `[userProfileApi] Uploading avatar. Original name: "${originalName}", Type: ${originalFile.type}, Size: ${originalFile.size}, FormData filename: "${simplifiedFilename}"`
  );

  try {
    // 后端期望 'avatar' 字段包含文件
    // 通过传递 config 来覆盖 useApi 中的默认 Content-Type
    const responseData = await post<UploadAvatarResponse>(
      '/users/me/avatar',
      formData,
      {
        headers: {
          // 设置为 undefined 会让 axios 在遇到 FormData 时自动设置 Content-Type 为 multipart/form-data 并生成 boundary
          'Content-Type': undefined,
        },
      }
    );
    return responseData;
  } catch (error: any) {
    console.error('上传头像失败 (AxiosError):', error);
    // Elysia 校验错误通常在 error.response.data 中，可能是一个对象数组或单个对象
    // error.response.data.errors (Elysia 0.8+) or error.response.data (older/custom)
    // error.response.data.message (if custom error format)
    // The specific error from t.File is in `error.response.data.errors[0].message` for Elysia 1.x
    // or directly in `error.response.data.message` if the schema error string is returned.
    // The backend schema has: error: '头像文件必须是图片格式...'
    // This implies the error message might be directly in a top-level field or within an errors array.

    let detailedMessage = '上传头像时发生未知网络错误';
    if (error.response && error.response.data) {
      const responseData = error.response.data;
      if (typeof responseData.error === 'string') { // 检查后端自定义的 error 字段
        detailedMessage = responseData.error;
      } else if (responseData.message && typeof responseData.message === 'string') { // 通用 message 字段
        detailedMessage = responseData.message;
      } else if (Array.isArray(responseData.errors) && responseData.errors.length > 0 && responseData.errors[0].message) {
        // Elysia 1.x t.File validation error structure
        detailedMessage = responseData.errors[0].message;
      } else if (typeof responseData === 'string') { // 有时错误直接是字符串
        detailedMessage = responseData;
      }
    } else if (error.message) {
      detailedMessage = error.message; // Fallback to Axios error message
    }
    
    throw { success: false, message: detailedMessage };
  }
}