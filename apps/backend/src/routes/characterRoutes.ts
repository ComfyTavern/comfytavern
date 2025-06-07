import { Buffer } from 'buffer';
import { Elysia, t } from 'elysia';
import { promises as fs } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore // png-chunk-text 可能没有完美的 TS 类型
import PNGtext from 'png-chunk-text';
// @ts-ignore // png-chunks-extract 可能没有完美的 TS 类型
import extract from 'png-chunks-extract';

import { SILLYTAVERN_DIR } from '../config'; // 导入 SILLYTAVERN_DIR

import type { CharacterCard, ApiCharacterEntry } from '@comfytavern/types'; // 导入 ApiCharacterEntry

// 获取当前文件的目录 (ES Module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); // apps/backend/src/routes

// 角色卡数据目录
const CHARACTER_CARD_DIR = path.join(SILLYTAVERN_DIR, 'CharacterCard');

console.log(`[CharacterRoutes] Character card directory set to: ${CHARACTER_CARD_DIR}`);

// 辅助函数：从PNG图片中提取角色卡数据
async function readCharacterDataFromPng(filePath: string): Promise<CharacterCard | null> {
  try {
    const imageBuffer = await fs.readFile(filePath);
    const chunks = extract(new Uint8Array(imageBuffer));
    const textChunks = chunks.filter((chunk: any) => chunk.name === 'tEXt').map((chunk: any) => PNGtext.decode(chunk.data));

    if (textChunks.length === 0) {
      return null;
    }

    // 优先尝试 ccv3 (SillyTavern format)
    const ccv3Chunk = textChunks.find((chunk: any) => chunk.keyword === 'ccv3');
    if (ccv3Chunk) {
      const jsonStr = Buffer.from(ccv3Chunk.text, 'base64').toString('utf8');
      return JSON.parse(jsonStr) as CharacterCard;
    }
    
    // 然后尝试 chara (TavernAI format)
    const charaChunk = textChunks.find((chunk: any) => chunk.keyword === 'chara');
    if (charaChunk) {
      const jsonStr = Buffer.from(charaChunk.text, 'base64').toString('utf8');
      return JSON.parse(jsonStr) as CharacterCard;
    }

    return null;
  } catch (error) {
    console.error(`从PNG提取角色数据失败 ${filePath}:`, error);
    return null;
  }
}


export const characterApiRoutes = new Elysia({ prefix: '/api/characters' })
  .onError(({ code, error, set }) => {
    console.error(`[CharacterRoutes] Error: ${code} - ${error.toString()}`);
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { success: false, message: '资源未找到' };
    }
    set.status = 500;
    return { success: false, message: '服务器内部错误' };
  })
  .get('/', async ({ set }) => {
    try {
      console.log(`[CharacterRoutes] Attempting to read directory: ${CHARACTER_CARD_DIR}`);
      try {
        await fs.access(CHARACTER_CARD_DIR);
      } catch (accessError: any) {
        if (accessError.code === 'ENOENT') {
          console.log(`[CharacterRoutes] Character card directory not found, creating: ${CHARACTER_CARD_DIR}`);
          try {
            await fs.mkdir(CHARACTER_CARD_DIR, { recursive: true });
            console.log(`[CharacterRoutes] Successfully created directory: ${CHARACTER_CARD_DIR}`);
          } catch (mkdirError: any) {
            console.error(`[CharacterRoutes] Failed to create directory ${CHARACTER_CARD_DIR}:`, mkdirError);
            // 如果创建目录失败，则抛出错误，让外层catch处理
            throw mkdirError;
          }
        } else {
          // 如果是其他访问错误，也抛出
          throw accessError;
        }
      }
      const files = await fs.readdir(CHARACTER_CARD_DIR);
      const characterCardsData: any[] = []; // 稍后定义更严格的类型
      const processedPngFiles = new Set<string>(); // 跟踪已从PNG处理的文件名（不含扩展名）

      // 1. 处理 PNG 文件并尝试提取元数据
      for (const file of files) {
        if (file.toLowerCase().endsWith('.png')) {
          const baseName = file.substring(0, file.length - 4);
          const filePath = path.join(CHARACTER_CARD_DIR, file);
          const pngData = await readCharacterDataFromPng(filePath);

          if (pngData) {
            characterCardsData.push({
              fileName: file, // 用于图片URL
              name: pngData.name || baseName,
              description: pngData.description,
              tags: pngData.tags || [],
              creator: pngData.data?.creator, // 从 data 对象获取
              creatorComment: pngData.creatorcomment || pngData.data?.creator_notes, // 统一 comment
              create_date: pngData.create_date,
              // ... 其他从pngData提取的字段
              dataFrom: 'png_metadata',
              rawCardData: pngData, // 保留原始数据以供后续合并
            });
            console.log(`[CharacterRoutes] Processed PNG with metadata: ${file}, card name: ${pngData.name || baseName}, fileName: ${file}`);
            processedPngFiles.add(baseName);
          } else {
            // 如果PNG没有元数据，也将其作为基本卡片添加，后续可能由JSON补充
             characterCardsData.push({
              fileName: file, // fileName 是完整的 png 文件名
              name: baseName, // name 是不带后缀的文件名
              dataFrom: 'png_file_only',
            });
            console.log(`[CharacterRoutes] Processed PNG (no metadata): ${file}, card name: ${baseName}, fileName: ${file}`);
          }
        }
      }

      // 2. 处理 JSON 文件，并与PNG数据合并/补充
      for (const file of files) {
        if (file.toLowerCase().endsWith('.json')) {
          const baseName = file.substring(0, file.length - 5);
          const filePath = path.join(CHARACTER_CARD_DIR, file);
          
          try {
            const jsonContent = await fs.readFile(filePath, 'utf-8');
            const jsonData = JSON.parse(jsonContent) as CharacterCard;

            const existingCardIndex = characterCardsData.findIndex(
              (card) => card.name === (jsonData.name || baseName) || card.fileName?.startsWith(baseName + '.')
            );

            if (existingCardIndex !== -1) {
              // 合并或覆盖数据，JSON优先部分字段
              const existingCard = characterCardsData[existingCardIndex];
              const pngRaw = existingCard.rawCardData || {} as CharacterCard; // PNG的原始数据
              const jsonRaw = jsonData;                     // JSON的原始数据

              const mergedName = jsonRaw.name || pngRaw.name || baseName;
              const mergedDescription = jsonRaw.description || pngRaw.description;
              const mergedTags = jsonRaw.tags || pngRaw.tags || [];
              const mergedCreatorComment = jsonRaw.creatorcomment || pngRaw.creatorcomment; // 顶级 creatorcomment
              const mergedCreateDate = jsonRaw.create_date || pngRaw.create_date;
              
              // 合并内部的 data 对象，JSON 优先
              const mergedInternalData = {
                  ...(pngRaw.data || {}),
                  ...(jsonRaw.data || {}),
                  name: jsonRaw.data?.name || pngRaw.data?.name, // 通常与顶级name一致
                  description: jsonRaw.data?.description || pngRaw.data?.description, // 通常与顶级description一致
                  creator: jsonRaw.data?.creator || pngRaw.data?.creator,
                  creator_notes: jsonRaw.data?.creator_notes || pngRaw.data?.creator_notes,
                  tags: jsonRaw.data?.tags || pngRaw.data?.tags, // data内部的tags
                  character_version: jsonRaw.data?.character_version || pngRaw.data?.character_version,
                  alternate_greetings: jsonRaw.data?.alternate_greetings || pngRaw.data?.alternate_greetings,
                  extensions: { ...(pngRaw.data?.extensions || {}), ...(jsonRaw.data?.extensions || {})},
              };

              // 更新 existingCard
              characterCardsData[existingCardIndex] = {
                  // 先放 jsonData 的所有顶级属性，这将覆盖 pngRaw 中的同名顶级属性
                  ...jsonRaw,
                  // 然后用我们计算好的合并值或来自 pngRaw 的值（如果 jsonRaw 中没有）来精确设置
                  fileName: existingCard.fileName, // 来自PNG，不能被JSON覆盖
                  name: mergedName,
                  description: mergedDescription,
                  tags: mergedTags,
                  creatorcomment: mergedCreatorComment,
                  create_date: mergedCreateDate,
                  // fav 和 talkativeness 也需要合并策略
                  fav: jsonRaw.fav ?? pngRaw.fav,
                  talkativeness: jsonRaw.talkativeness || pngRaw.talkativeness,
                  // 最后是合并后的 data 对象
                  data: mergedInternalData,
                  dataFrom: existingCard.dataFrom === 'png_metadata' ? 'png_metadata_and_json' : 'json_only',
                  rawCardData: { ...pngRaw, ...jsonRaw, data: mergedInternalData }, // 更新rawCardData
              };
              console.log(`[CharacterRoutes] Merged JSON for card: ${mergedName}, original PNG fileName: ${existingCard.fileName}, final fileName in card: ${characterCardsData[existingCardIndex].fileName}`);
            } else if (!processedPngFiles.has(baseName)) { // 如果没有对应的PNG元数据被处理过
              // 对于纯JSON文件 (之前这里有嵌套push的错误)
              const newJsonCard = {
                  // 先放 jsonData 的所有顶级属性
                  ...jsonData,
                  // 然后确保关键字段有值，并使用 baseName 作为 name 的备选
                  fileName: null, // 稍后尝试关联PNG
                  name: jsonData.name || baseName,
                  // description, tags, creatorcomment, create_date, fav, talkativeness, data 等已通过 ...jsonData 设置
                  // 如果 jsonData 中没有这些顶级字段，它们会是 undefined，符合 CharacterCard 类型定义中的可选性
                  dataFrom: 'json_only',
                  rawCardData: jsonData,
              };
              characterCardsData.push(newJsonCard);
              console.log(`[CharacterRoutes] Added pure JSON card: ${newJsonCard.name}`);
            }
          } catch (jsonError) {
            console.error(`解析JSON文件失败 ${filePath}:`, jsonError);
          }
        }
      }
      
      // 为每个角色卡生成一个唯一的ID，并确保有图片文件名（如果适用）
      const finalCharacters: ApiCharacterEntry[] = characterCardsData.map((card, index) => {
        let imageName = card.fileName;
        // 如果卡片主要来自JSON且没有fileName，但存在同名PNG，则关联
        if (!imageName && (card.dataFrom === 'json_only' || card.dataFrom === 'png_metadata_and_json')) {
            const matchingPng = files.find(f => f.toLowerCase().startsWith(String(card.name).toLowerCase()) && f.toLowerCase().endsWith('.png'));
            if (matchingPng) {
                imageName = matchingPng;
            }
        }
        console.log(`[CharacterRoutes] Mapping to final: card name: ${card.name}, card.fileName: ${card.fileName}, determined imageName: ${imageName}`);
        // 确保返回的对象符合 ApiCharacterEntry 接口
        return {
          id: card.id || `${String(card.name)}_${index}`, // card中可能有id，否则生成
          name: card.name,
          description: card.description,
          imageName: imageName,
          tags: card.tags || [],
          creator: card.data?.creator,
          creatorComment: card.creatorcomment || card.data?.creator_notes, // 确保驼峰
          createDate: card.create_date, // 确保驼峰
          characterVersion: card.data?.character_version,
          talkativeness: card.talkativeness || card.data?.extensions?.talkativeness,
          favorite: card.fav ?? card.data?.extensions?.fav ?? false,
          avatar: card.avatar,
          chat: card.chat,
        };
      }).filter(card => card && card.name) as ApiCharacterEntry[]; // 过滤掉无效卡片并断言类型

      // 进一步确保字段名为驼峰 (createDate, creatorComment)
      const trulyFinalCharacters = finalCharacters.map(fc => ({
        ...fc,
        createDate: fc.createDate, // 如果之前是 create_date，这里会修正
        creatorComment: fc.creatorComment, // 如果之前是 creatorcomment，这里会修正
      }));
      const summaryLog = trulyFinalCharacters.map(c => ({ id: c.id, name: c.name, imageName: c.imageName }));
      console.log('[CharacterRoutes] Returning final characters summary to frontend:', JSON.stringify(summaryLog, null, 2));
      return { success: true, data: trulyFinalCharacters };
    } catch (error: any) {
      console.error('[CharacterRoutes] GET / - Error reading character directory:', error);
      set.status = 500;
      return { success: false, message: '无法读取角色卡目录', details: error.message };
    }
  })
  .get('/image/:imageName', async ({ params, set }) => {
    const { imageName: encodedImageName } = params; // 接收编码后的文件名
    const imageName = decodeURIComponent(encodedImageName); // 进行URL解码

    // 安全检查：防止路径遍历 (对解码后的 imageName 进行检查)
    if (imageName.includes('..') || imageName.includes('/')) {
      set.status = 400;
      return { success: false, message: '无效的图片名称 (路径遍历)' };
    }

    const imagePath = path.join(CHARACTER_CARD_DIR, imageName); // 使用解码后的文件名构造路径
    console.log(`[CharacterRoutes] Image request: Received encoded="${encodedImageName}", decoded="${imageName}", Constructed path="${imagePath}"`);
    
    try {
      // console.log(`[CharacterRoutes] Attempting to serve image: ${imagePath}`);
      // 检查文件是否存在
      await fs.access(imagePath);
      console.log(`[CharacterRoutes] Image file found at: ${imagePath}`);
      const fileStream = await fs.readFile(imagePath); // Elysia 可以直接处理 Buffer
      
      // 根据文件扩展名设置 Content-Type
      const ext = path.extname(imageName).toLowerCase();
      if (ext === '.png') {
        set.headers['Content-Type'] = 'image/png';
      } else if (ext === '.jpg' || ext === '.jpeg') {
        set.headers['Content-Type'] = 'image/jpeg';
      } else if (ext === '.webp') {
        set.headers['Content-Type'] = 'image/webp';
      } else {
        set.status = 415; // 不支持的媒体类型
        return { success: false, message: '不支持的图片格式' };
      }
      
      return fileStream; // 直接返回 Buffer
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`[CharacterRoutes] GET /image/${imageName} - Image not found: ${imagePath}`);
        set.status = 404;
        return { success: false, message: '图片未找到' };
      }
      console.error(`[CharacterRoutes] GET /image/${imageName} - Error serving image:`, error);
      set.status = 500;
      return { success: false, message: '无法提供图片', details: error.message };
    }
  }, {
    params: t.Object({
      imageName: t.String()
    })
  });

console.log('[CharacterRoutes] Character API routes defined.');