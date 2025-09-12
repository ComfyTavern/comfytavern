import { z } from 'zod';
import { PanelDeclarationSchema } from './panel';

// --- Project & Asset Schemas ---

/**
 * Schema 定义：项目元数据。
 */
export const ProjectMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  templateUsed: z.string().optional(),
  preferredView: z.enum(["editor", "custom"]).optional().default("editor"),
  schemaVersion: z.string(),
  panels: z.array(PanelDeclarationSchema).optional().describe("项目包含的应用面板声明列表"),
  enableChatPage: z.boolean().optional().default(true).describe("是否启用聊天页面功能"),
  customMetadata: z.record(z.any()).optional()
});
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;


// --- File Asset Management (FAM) Schemas ---

/**
 * Schema 定义：文件资产管理系统中的单个项目（文件或目录）。
 */
export const FAMItemSchema = z.object({
  id: z.string().min(1, { message: "ID 不能为空" }), // 通常等于 logicalPath
  name: z.string().min(1, { message: "名称不能为空" }),
  logicalPath: z.string().min(1, { message: "逻辑路径不能为空" }),
  itemType: z.enum(['file', 'directory'], { message: "项目类型必须是 'file' 或 'directory'" }),
  size: z.number().nonnegative({ message: "大小不能为负" }).nullable().optional(),
  lastModified: z.number().int({ message: "最后修改时间必须是整数时间戳" }).nullable().optional(), // Unix timestamp in milliseconds
  mimeType: z.string().nullable().optional(),
  isSymlink: z.boolean().nullable().optional().default(false),
  targetLogicalPath: z.string().nullable().optional(),
  isWritable: z.boolean().nullable().optional().default(true),
  childrenCount: z.number().int().nonnegative({ message: "子项目数量不能为负" }).nullable().optional(),
  thumbnailUrl: z.string().url({ message: "缩略图 URL 必须是有效的 URL" }).nullable().optional(),
  error: z.string().nullable().optional(),
});
export type FAMItem = z.infer<typeof FAMItemSchema>;

/**
 * Schema 定义：文件资产管理项目列表。
 */
export const FAMItemsSchema = z.array(FAMItemSchema);
export type FAMItems = z.infer<typeof FAMItemsSchema>;


// --- Agent & Scene Schemas (Agent Architecture v3) ---

/**
 * Schema 定义: 场景中 Agent 实例的配置。
 */
export const SceneAgentInstanceSchema = z.object({
  instance_id: z.string().describe("场景中 Agent 实例的唯一 ID"),
  profile_id: z.string().describe("引用的 Agent Profile ID"),
  initial_private_state_override: z.record(z.any()).optional().describe("覆盖 Profile 的 PrivateState 初始值"),
  initial_goals_override_reference: z.array(z.any()).optional().describe("覆盖 Profile 的初始目标"),
});

/**
 * Schema 定义: Agent 的静态蓝图或配置档案。
 */
export const AgentProfileSchema = z.object({
  id: z.string().describe("Agent Profile 的全局唯一标识符"),
  name: z.string().describe("用户可读的 Agent 名称"),
  description: z.string().optional().describe("对该 Agent 类型或角色的详细描述"),
  version: z.string().describe("Agent Profile 的版本号"),
  schema_version: z.string().describe("agent_profile.json 本身 Schema 的版本号"),
  core_deliberation_workflow_id: z.string().describe("指向核心审议循环的工作流ID"),
  initial_private_state_schema: z.record(z.any()).optional().describe("定义 PrivateState 的 JSON Schema"),
  initial_private_state_values: z.record(z.any()).optional().describe("PrivateState 的初始值"),
  knowledge_base_references: z.array(z.any()).optional().describe("可访问的知识库列表"),
  subscribed_event_types: z.array(z.any()).optional().describe("默认订阅的事件类型"),
  skill_workflow_ids_inventory: z.array(z.string()).optional().describe("拥有的“技能工作流”ID列表"),
  tool_ids_inventory: z.array(z.string()).optional().describe("可使用的“原子工具”标识符列表"),
  initial_goals_reference: z.array(z.any()).optional().describe("默认目标列表"),
});
export type AgentProfile = z.infer<typeof AgentProfileSchema>;

/**
 * Schema 定义: 场景定义，作为 Agent 的宿主环境。
 */
export const SceneDefinitionSchema = z.object({
  id: z.string().describe("场景定义的唯一标识符"),
  name: z.string().describe("用户可读的场景名称"),
  description: z.string().optional().describe("场景描述"),
  agent_instances: z.array(SceneAgentInstanceSchema).describe("场景中需要激活的 Agent 实例列表"),
  initial_world_state: z.record(z.any()).optional().describe("场景的初始世界状态"),
  associated_panels: z.array(z.any()).optional().describe("关联的应用面板"),
  scene_lifecycle_workflows: z.record(z.string()).optional().describe("场景生命周期工作流"),
});
export type SceneDefinition = z.infer<typeof SceneDefinitionSchema>;