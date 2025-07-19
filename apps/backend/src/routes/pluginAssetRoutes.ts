import { Elysia } from 'elysia';
import { PluginLoader } from '../services/PluginLoader';
import path from 'node:path';
import { existsSync } from 'node:fs';

export const pluginAssetRoutes = (app: Elysia) =>
  app.get('/plugins/:pluginName/*', ({ params, set }) => {
    const pluginName = params.pluginName;
    const requestedFile = params['*'];

    const pluginInfo = PluginLoader.extensions.find(ext => ext.name === pluginName);

    if (!pluginInfo || !pluginInfo.frontend || !pluginInfo.frontend.webRootDir) {
      set.status = 404;
      return { error: `Plugin '${pluginName}' not found or has no frontend assets.` };
    }

    const filePath = path.join(pluginInfo.frontend.webRootDir, requestedFile);

    // 安全检查：确保文件路径在预期的 webRootDir 内
    const isSafe = path.resolve(filePath).startsWith(path.resolve(pluginInfo.frontend.webRootDir));
    if (!isSafe) {
      set.status = 403;
      return { error: 'Forbidden' };
    }

    if (!existsSync(filePath)) {
      set.status = 404;
      return { error: `File not found: ${requestedFile}` };
    }

    const file = Bun.file(filePath);
    return new Response(file.stream(), {
      headers: { 'Content-Type': file.type },
    });
  });