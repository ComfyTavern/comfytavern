# ComfyTavern 插件目录

此目录用于存放所有第三方或非核心的 ComfyTavern 插件。

## 如何安装插件

1.  将你的插件文件夹直接复制或克隆到此 `plugins/` 目录下。
2.  确保你的插件遵循指定的目录结构，并包含一个有效的 `plugin.yaml` 清单文件。

### 示例结构

```
ComfyTavern/
└── plugins/
    ├── a-cool-plugin/
    │   ├── nodes/
    │   │   └── CoolNode.ts
    │   ├── web/
    │   │   └── index.js
    │   └── plugin.yaml
    │
    └── another-plugin/
        └── ...
```

有关插件开发的详细信息，请参阅官方文档。