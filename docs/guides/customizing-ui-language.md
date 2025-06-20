# 如何为 ComfyTavern 添加或更新 UI 语言包

ComfyTavern 支持用户自定义界面语言。通过添加自定义语言包，您可以将应用程序的 UI 翻译成您偏好的语言，或者覆盖现有的翻译。本文档将指导您完成创建、应用、以及维护自定义语言包的过程。

## 先决条件

- 您需要能够访问 ComfyTavern 的文件系统，特别是用户特定的文件目录。这通常通过应用内建的文件管理器或直接访问文件系统来完成。
- 如果您是开发者并希望生成最新的翻译模板，您需要在本地设置好 ComfyTavern 的开发环境，并安装好 `bun`。

## 步骤概览

1.  **获取或生成语言包模板**：使用预置的模板或通过脚本生成最新的模板文件。
2.  **创建并翻译语言包**：基于模板创建您的语言 JSON 文件，并完成翻译。
3.  **放置语言包文件**：将创建的 JSON 文件放置到用户或共享语言包目录下。
4.  **在应用中选择新语言**：在 ComfyTavern 的设置中选择并应用您的自定义语言。

## 详细步骤

### 步骤 1：创建语言包 JSON 文件

您的自定义语言包必须是一个 JSON 文件，其内容需要遵循特定结构。

#### a. 文件命名

文件名应遵循 BCP 47 语言代码规范，并以 `.json` 结尾。例如：

-   法语（法国）：`fr-FR.json`
-   韩语（韩国）：`ko-KR.json`
-   西班牙语（西班牙）：`es-ES.json`

#### b. 文件内容结构

每个语言包 JSON 文件**必须**包含一个顶层的 `_meta` 对象，用于描述该语言包。`_meta` 对象包含以下字段：

-   `name` (字符串): 语言的英文名称（例如："French (France)"）。
-   `nativeName` (字符串): 语言的母语名称（例如："Français (France)"）。

#### c. 获取翻译模板并翻译

除了 `_meta` 对象外，文件的其余部分应包含您要翻译的键值对。**强烈建议您使用项目提供的模板作为起点，以确保覆盖所有必要的翻译键。**

我们提供了一个自动扫描脚本 [`scripts/i18n-scanner.ts`](../../scripts/i18n-scanner.ts) 来从源代码中提取所有需要翻译的文本键，并生成一个模板文件。

**对于普通用户：**
您可以直接使用项目中预置的模板文件：[`scripts/locales-template.json`](../../scripts/locales-template.json)。
这个文件包含了所有UI文本的键，以及一个供您填写的 `_meta` 结构，对应的值均为 `"[TODO]"`。您需要做的就是：
1.  复制 [`scripts/locales-template.json`](../../scripts/locales-template.json) 的内容。
2.  创建一个新的、以上述命名规范命名的文件（例如 `fr-FR.json`）。
3.  将复制的内容粘贴进去，然后修改 `_meta` 对象中的占位符为您语言的实际名称。
4.  将所有其他值为 `"[TODO]"` 的键翻译成您的目标语言。

**对于开发者：**
如果您想获取最新的模板，可以运行扫描脚本。详情请见“开发者指南”部分。

#### d. 示例 `fr-FR.json`

这是一个基于模板翻译完成的法语语言包示例。

```json
{
  "_meta": {
    "name": "French (France)",
    "nativeName": "Français (France)"
  },
  "common": {
    "confirm": "Confirmer",
    "cancel": "Annuler",
    "save": "Enregistrer",
    "delete": "[TODO]"
    // ... 其他通用翻译 ...
  },
  "nav": {
    "home": "Accueil",
    "editor": "Éditeur",
    "settings": "[TODO]"
    // ... 其他导航翻译 ...
  }
  // ... 更多翻译键 ...
}
```

**重要提示：**
- 确保您的 JSON 文件格式正确。
- 翻译键的层级结构应与模板保持一致。
- 如果您只想覆盖部分翻译，只需在您的自定义语言包中提供您想修改的键即可。系统会将您的翻译与内置翻译合并。

### 步骤 2：放置语言包文件

创建好语言包 JSON 文件后，您需要将其放置到 ComfyTavern 的用户语言包目录中。该目录通常位于：

- 内部文件管理器的路径：`user://library/locales/ui/@ComfyTavern-ui/` 或者 `userData\{UID}\library\locales\ui\@ComfyTavern-ui`

您可以使用 ComfyTavern 内置的文件管理器导航到此路径并上传您的 JSON 文件。如果该目录不存在，您可能需要手动创建它。

例如，如果您创建了 `fr-FR.json`，则应将其放置为：
`user://library/locales/ui/@ComfyTavern-ui/fr-FR.json`

您还可以将语言包文件放置在共享目录中`shared://library/locales/ui/@ComfyTavern-ui/` 或者`public\library\locales\ui\@ComfyTavern-ui` ，以便访问该部署实例的其他用户可以使用这些语言包。

### 步骤 3：在应用中选择新语言

放置好语言包文件后：

1.  **重新启动 ComfyTavern** 或 **刷新浏览器页面**。这将触发应用重新发现可用的语言包。
2.  进入应用的 **设置 (Settings)** 界面。
3.  找到 **界面语言 (Interface Language)** 或类似选项。
4.  您的自定义语言（以其 `nativeName` 显示）应该会出现在语言选择列表中。
5.  选择您的语言，应用应该会切换到新的语言。

如果您的语言没有出现，请检查：
-   JSON 文件名和路径是否正确。
-   JSON 文件内容是否有效，特别是 `_meta` 部分。
-   文件管理器是否已正确同步文件。

## 开发者指南：生成与更新语言包

为了方便开发者和贡献者维护语言包，我们提供了一个强大的扫描工具：[`scripts/i18n-scanner.ts`](../../scripts/i18n-scanner.ts)。

该脚本会自动扫描前端所有 `.vue` 和 `.ts` 文件，提取所有 i18n 翻译键，并执行以下操作：

1.  **生成一个干净的翻译模板**。
2.  **与现有的语言文件（如 `zh-CN.json`）进行比较**，并报告新增和已过时的键。
3.  **生成一个合并后的文件**，方便您更新现有的语言包。

### 如何运行扫描脚本

在项目根目录下执行以下命令：

```bash
bun run scripts/i18n-scanner.ts
```

### 脚本输出

脚本执行后，会生成或更新以下文件：

-   `scripts/locales-template.json`:
    这是最纯净的翻译模板，包含了所有从代码中扫描到的键，值为 `"[TODO]"`。创建新的语言包时，应以此文件为基础。

-   `scripts/zh-CN.merged.json`:
    这是一个示例合并文件。脚本会将扫描到的新键（值为 `"[TODO]"`）合并到现有的 `zh-CN.json` 文件中，并（默认）移除已过时的键。控制台会打印出详细的新增和过时键列表。您可以检查这个合并后的文件，然后用它来更新官方的语言包。

这个自动化流程极大地简化了多语言的同步和维护工作。

## 高级：翻译覆盖与合并

ComfyTavern 的语言加载机制具有层级和合并特性：

1.  **加载顺序与优先级**：
    *   **内置语言包**：作为基础加载。
    *   **共享语言包** (`shared://library/locales/ui/@ComfyTavern-ui/`)：如果存在，会覆盖内置翻译。
    *   **用户语言包** (`user://library/locales/ui/@ComfyTavern-ui/`)：具有最高优先级，会覆盖共享和内置翻译。

2.  **合并逻辑**：
    *   当加载一种语言时（例如，您选择的自定义语言 `fr-FR`），系统会首先加载该语言的内置版本（如果存在），然后是共享版本，最后是用户版本。
    *   对于相同的翻译键，后加载的语言包中的值会覆盖先加载的。
    *   这意味着您不必在自定义语言包中提供所有翻译。您只需提供您想要添加或修改的翻译即可。未在您的文件中定义的键将回退到共享或内置版本。

例如，如果内置的 `en-US.json` 有 `common.save: "Save"`，而您的 `user://.../en-US.json` 中定义了 `common.save: "Save Changes"`，则界面上将显示 "Save Changes"。如果您的文件中没有定义 `common.cancel`，则会使用内置的 "Cancel"。

## 故障排除

-   **语言未显示在列表中**：
    -   检查 JSON 文件名和路径。
    -   验证 JSON 格式是否正确（可以使用在线 JSON 验证器）。
    -   确保 `_meta.name` 和 `_meta.nativeName` 已正确填写。
-   **部分文本未翻译**：
    -   检查您的语言包中是否包含了对应的翻译键。
    -   确保翻译键的层级结构与官方语言包或模板一致。
-   **控制台错误**：
    -   打开浏览器开发者工具的控制台，查看是否有关于语言文件加载或解析的错误信息。

通过以上步骤，您应该能够成功为 ComfyTavern 添加和应用自定义的 UI 语言包。祝您使用愉快！