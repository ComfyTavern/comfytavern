/**
 * 获取后端的 API 基础 URL。
 * 它会根据当前页面的协议和主机名动态构建 URL。
 * 端口号可以通过 VITE_API_PORT 环境变量配置，默认为 3233。
 * @returns {string} API 基础 URL (例如: 'https://yourdomain.com:3233/api')
 */
export function getApiBaseUrl(): string {
  const API_PROTOCOL = window.location.protocol; // 使用当前页面的协议 (e.g., 'http:', 'https:')
  const API_HOST = window.location.hostname;     // 使用当前页面的主机名
  const API_PORT = import.meta.env.VITE_API_PORT || '3233'; // 端口通常是固定的
  
  // 判断是否需要显式添加端口
  const isDefaultPort = (API_PORT === '80' && API_PROTOCOL === 'http:') ||
                         (API_PORT === '443' && API_PROTOCOL === 'https:');
  
  // 如果是默认端口，则不添加端口部分
  const url = isDefaultPort
    ? `${API_PROTOCOL}//${API_HOST}/api`
    : `${API_PROTOCOL}//${API_HOST}:${API_PORT}/api`;
    
  console.debug(`Dynamic API Base URL generated: ${url}`);
  return url;
}

/**
 * 获取后端的根基础 URL (不含 /api)。
 * 用于加载客户端脚本等非 API 资源。
 * @returns {string} 后端根基础 URL (例如: 'https://yourdomain.com:3233')
 */
export function getBackendBaseUrl(): string {
  const API_PROTOCOL = window.location.protocol;
  const API_HOST = window.location.hostname;
  const API_PORT = import.meta.env.VITE_API_PORT || '3233';
  
  // 判断是否需要显式添加端口
  const isDefaultPort = (API_PORT === '80' && API_PROTOCOL === 'http:') ||
                         (API_PORT === '443' && API_PROTOCOL === 'https:');
  
  // 如果是默认端口，则不添加端口部分
  const url = isDefaultPort
    ? `${API_PROTOCOL}//${API_HOST}`
    : `${API_PROTOCOL}//${API_HOST}:${API_PORT}`;
    
  // console.log(`Dynamic Backend Base URL generated: ${url}`); // 可选日志
  return url;
}

/**
 * 获取后端的 WebSocket URL。
 * 它会根据当前页面的协议 (http -> ws, https -> wss) 和主机动态构建 URL。
 * @returns {string} WebSocket URL (例如: 'wss://yourdomain.com/ws')
 */
export function getWebSocketUrl(): string {
  const HTTP_PROTOCOL = window.location.protocol;
  const WS_PROTOCOL = HTTP_PROTOCOL === 'https:' ? 'wss' : 'ws';
  const WS_HOST = window.location.hostname; // 使用主机名，不含端口
  const WS_PORT = import.meta.env.VITE_API_PORT || '3233'; // 使用后端端口
  
  // 判断是否需要显式添加端口
  const isDefaultPort = (WS_PORT === '80' && HTTP_PROTOCOL === 'http:') ||
                         (WS_PORT === '443' && HTTP_PROTOCOL === 'https:');
  
  // 如果是默认端口，则不添加端口部分
  const url = isDefaultPort
    ? `${WS_PROTOCOL}://${WS_HOST}/ws`
    : `${WS_PROTOCOL}://${WS_HOST}:${WS_PORT}/ws`;
    
  console.debug(`Dynamic WebSocket URL generated: ${url}`);
  return url;
}