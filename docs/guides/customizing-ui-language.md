# 如何为 ComfyTavern 添加自定义 UI 语言包

ComfyTavern 支持用户自定义界面语言。通过添加自定义语言包，您可以将应用程序的 UI 翻译成您偏好的语言，或者覆盖现有的翻译。本文档将指导您完成创建和应用自定义语言包的过程。

## 先决条件

- 您需要能够访问 ComfyTavern 的文件系统，特别是用户特定的文件目录。这通常通过应用内建的文件管理器或直接访问文件系统来完成。

## 步骤概览

1.  **创建语言包 JSON 文件**：按照指定格式创建一个包含翻译文本的 JSON 文件。
2.  **放置语言包文件**：将创建的 JSON 文件放置到用户语言包目录下。
3.  **在应用中选择新语言**：在 ComfyTavern 的设置中选择并应用您的自定义语言。

## 详细步骤

### 步骤 1：创建语言包 JSON 文件

您的自定义语言包必须是一个 JSON 文件，其内容需要遵循以下结构：

#### a. 文件命名

文件名应遵循 BCP 47 语言代码规范，并以 `.json` 结尾。例如：

-   法语（法国）：`fr-FR.json`
-   韩语（韩国）：`ko-KR.json`
-   西班牙语（西班牙）：`es-ES.json`

#### b. 文件内容结构

每个语言包 JSON 文件**必须**包含一个顶层的 `_meta` 对象，用于描述该语言包。`_meta` 对象包含以下字段：

-   `name` (字符串): 语言的英文名称（例如："French (France)"）。
-   `nativeName` (字符串): 语言的母语名称（例如："Français (France)"）。

除了 `_meta` 对象外，文件的其余部分应包含您要翻译的键值对。这些键值对应应用界面中的各个文本元素。**强烈建议您复制一份现有的语言包文件（例如 [`apps/frontend-vueflow/src/locales/en-US.json`](../../apps/frontend-vueflow/src/locales/en-US.json) 或 [`apps/frontend-vueflow/src/locales/zh-CN.json`](../../apps/frontend-vueflow/src/locales/zh-CN.json)）作为模板，然后修改其内容。**

**示例 `fr-FR.json`：**

```json
{
  "_meta": {
    "name": "French (France)",
    "nativeName": "Français (France)"
  },
  "common": {
    "confirm": "Confirmer",
    "cancel": "Annuler",
    "save": "Enregistrer"
    // ... 其他通用翻译 ...
  },
  "nav": {
    "home": "Accueil",
    "editor": "Éditeur"
    // ... 其他导航翻译 ...
  }
  // ... 更多翻译键 ...
}
```

**重要提示：**

-   确保您的 JSON 文件格式正确。
-   翻译键的层级结构应与官方语言包保持一致，以确保所有文本都能被正确替换。
-   如果您只想覆盖部分翻译，只需在您的自定义语言包中提供您想修改的键即可。系统会将您的翻译与内置翻译合并（详见“高级：翻译覆盖与合并”部分）。

### 步骤 2：放置语言包文件

创建好语言包 JSON 文件后，您需要将其放置到 ComfyTavern 的用户语言包目录中。该目录通常位于：

内部文件管理器的路径：`user://library/locales/ui/@ComfyTavern-ui/` 或者 `userData\{UID}\library\locales\ui\@ComfyTavern-ui`

您可以使用 ComfyTavern 内置的文件管理器导航到此路径并上传您的 JSON 文件。如果该目录不存在，您可能需要手动创建它（或其父目录）。

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
    -   确保翻译键的层级结构与官方语言包一致。
-   **控制台错误**：
    -   打开浏览器开发者工具的控制台，查看是否有关于语言文件加载或解析的错误信息。

通过以上步骤，您应该能够成功为 ComfyTavern 添加和应用自定义的 UI 语言包。祝您使用愉快！