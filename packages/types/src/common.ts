import { z } from 'zod';

/**
 * Nano ID 的类型别名，通常是字符串。
 */
export type NanoId = string;


/**
 * RegexRule 相关的类型和 Schema
 */
export interface RegexRule {
  name: string;
  pattern: string;
  replacement: string;
  flags?: string;
  description?: string;
  enabled?: boolean;
}

export const RegexRuleSchema = z.object({
  name: z.string().min(1, { message: "规则名称不能为空" }),
  pattern: z.string().min(1, { message: "正则表达式不能为空" }),
  replacement: z.string(),
  flags: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
});

export const RegexRuleArraySchema = z.array(RegexRuleSchema);
