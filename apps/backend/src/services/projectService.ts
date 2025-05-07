import { promises as fs } from "node:fs";
import path, { join, basename, extname } from "node:path";
import isEqual from "lodash/isEqual";
import {
  type WorkflowObject,
  type GroupInterfaceInfo,
  type WorkflowNode,
  type NodeGroupData,
} from "@comfytavern/types";
import { PROJECTS_BASE_DIR } from "../config"; // 导入项目基础目录

/**
 * 获取指定项目的工作流目录的绝对路径。
 * @param projectId - 项目 ID (应已清理)。
 * @returns 项目工作流目录的绝对路径。
 */
export const getProjectWorkflowsDir = (projectId: string): string => {
  // Note: projectId should already be sanitized before calling this function
  return path.join(PROJECTS_BASE_DIR, projectId, "workflows");
};

/**
 * 同步更新引用了特定工作流（作为 NodeGroup）的其他工作流中的接口快照。
 * 当一个工作流的接口（interfaceInputs/interfaceOutputs）发生变化时调用此函数。
 * @param projectId - 包含被更新工作流的项目 ID。
 * @param updatedWorkflowId - 接口被更新的工作流的 ID。
 * @param newInterface - 被更新工作流的新接口信息。
 */
export async function syncReferencingNodeGroups(
  projectId: string,
  updatedWorkflowId: string,
  newInterface: GroupInterfaceInfo
): Promise<void> {
  console.log(
    `Syncing NodeGroups referencing workflow ${updatedWorkflowId} in project ${projectId}`
  );
  // 注意：这里不再需要 resolve，因为 getProjectWorkflowsDir 返回绝对路径
  const projectWorkflowsDir = getProjectWorkflowsDir(projectId);

  try {
    const files = await fs.readdir(projectWorkflowsDir);
    const workflowFiles = files.filter(
      (file) =>
        extname(file).toLowerCase() === ".json" && basename(file, ".json") !== updatedWorkflowId // 排除自身
    );

    for (const file of workflowFiles) {
      const referencingWorkflowId = basename(file, ".json");
      const filePath = path.join(projectWorkflowsDir, file);
      let workflowData: WorkflowObject | null = null;
      let needsSave = false;

      try {
        const fileContent = await fs.readFile(filePath, "utf-8");
        try {
          workflowData = JSON.parse(fileContent) as WorkflowObject;
        } catch (parseError) {
          console.error(`Error parsing workflow file ${filePath} during sync:`, parseError);
          continue; // 跳到下一个文件
        }

        if (!workflowData || !Array.isArray(workflowData.nodes)) {
          console.warn(`Skipping invalid workflow data in ${filePath} during sync.`);
          continue;
        }

        // Define the expected full type for NodeGroupNode
        const nodeGroupFullType = 'core:NodeGroup';

        for (const node of workflowData.nodes as WorkflowNode[]) {
          // Use the full type string for comparison
          if (node.type === nodeGroupFullType && node.data && typeof node.data === "object") {
            const nodeGroupData = node.data as NodeGroupData;
            if (nodeGroupData.referencedWorkflowId === updatedWorkflowId) {
              const currentInterface = nodeGroupData.groupInterface || { inputs: {}, outputs: {} };
              const currentInputs = currentInterface.inputs || {};
              const currentOutputs = currentInterface.outputs || {};
              const newInputs = newInterface.inputs || {};
              const newOutputs = newInterface.outputs || {};

              if (!isEqual(currentInputs, newInputs) || !isEqual(currentOutputs, newOutputs)) {
                console.log(
                  `Updating interface snapshot for NodeGroup ${node.id} in workflow ${referencingWorkflowId}`
                );
                nodeGroupData.groupInterface = { inputs: newInputs, outputs: newOutputs };
                needsSave = true;
              }
            }
          }
        }

        if (needsSave && workflowData) {
          workflowData.updatedAt = new Date().toISOString();
          await fs.writeFile(filePath, JSON.stringify(workflowData, null, 2));
          console.log(
            `Saved updated workflow ${referencingWorkflowId} with synced NodeGroup interface.`
          );
        }
      } catch (readWriteError) {
        console.error(`Error processing workflow file ${filePath} during sync:`, readWriteError);
      }
    }
  } catch (error) {
    // 如果项目工作流目录本身不存在或无法读取，则记录错误
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      console.warn(
        `Project workflow directory not found during sync for project ${projectId}: ${projectWorkflowsDir}`
      );
    } else {
      console.error(`Error listing workflows in project ${projectId} during sync:`, error);
    }
    // 记录错误，但不影响主流程（例如，更新操作本身不应失败）
  }
}

import { ProjectMetadataSchema, type ProjectMetadata } from "@comfytavern/types"; // 导入 ProjectMetadata 类型和 Schema
import { z } from "zod"; // 导入 zod

// 定义可更新的元数据字段的 Schema
// 允许部分更新，但排除 id 和 createdAt
const ProjectMetadataUpdateSchema = ProjectMetadataSchema.partial().omit({
  id: true,
  createdAt: true,
});
type ProjectMetadataUpdate = z.infer<typeof ProjectMetadataUpdateSchema>;

/**
 * 更新指定项目的元数据文件 (project.json)。
 * @param projectId - 项目 ID (应已清理)。
 * @param updateData - 要更新的元数据字段 (应符合 ProjectMetadataUpdateSchema)。
 * @returns 更新后的完整项目元数据。
 * @throws 如果项目或元数据文件不存在，或发生读写/解析错误。
 */
export async function updateProjectMetadata(
  projectId: string,
  updateData: ProjectMetadataUpdate
): Promise<ProjectMetadata> {
  console.log(`Updating metadata for project ${projectId}`);
  const projectPath = path.join(PROJECTS_BASE_DIR, projectId);
  const metadataPath = path.join(projectPath, "project.json");

  try {
    // 1. 读取现有元数据
    let existingMetadata: ProjectMetadata;
    try {
      const fileContent = await fs.readFile(metadataPath, "utf-8");
      existingMetadata = ProjectMetadataSchema.parse(JSON.parse(fileContent));
    } catch (readError: any) {
      if (readError.code === "ENOENT") {
        console.error(`Metadata file not found for project ${projectId}: ${metadataPath}`);
        throw new Error(`Project metadata file not found for ID '${projectId}'.`); // 更具体的错误信息
      }
      console.error(
        `Error reading or parsing existing metadata for project ${projectId}:`,
        readError
      );
      throw new Error(`Failed to read or parse existing metadata for project ${projectId}.`);
    }

    // 2. 合并更新并设置 updatedAt
    const now = new Date().toISOString();
    const updatedMetadata: ProjectMetadata = {
      ...existingMetadata,
      ...updateData, // 应用传入的更新
      updatedAt: now, // 强制更新 updatedAt 字段
      // 确保 id 和 createdAt 不被覆盖 (虽然 schema 已排除，但再次确认)
      id: existingMetadata.id,
      createdAt: existingMetadata.createdAt,
    };

    // 3. 验证最终的元数据对象 (可选但推荐)
    const finalValidation = ProjectMetadataSchema.safeParse(updatedMetadata);
    if (!finalValidation.success) {
      console.error(
        "Final metadata validation failed after update:",
        finalValidation.error.flatten()
      );
      throw new Error("Internal error: Updated metadata failed validation.");
    }

    // 4. 写回文件
    await fs.writeFile(metadataPath, JSON.stringify(finalValidation.data, null, 2));
    console.log(`Project metadata updated successfully: ${metadataPath}`);

    return finalValidation.data;
  } catch (error) {
    // 重新抛出已知错误或包装未知错误
    if (
      error instanceof Error &&
      (error.message.includes("not found") || error.message.includes("Failed to read"))
    ) {
      throw error;
    }
    console.error(`Unexpected error updating project metadata for ${projectId}:`, error);
    throw new Error(`Failed to update project metadata for project ${projectId}.`);
  }
}
