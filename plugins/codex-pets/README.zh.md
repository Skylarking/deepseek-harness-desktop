# DSH 通用宠物插件

[English](README.md) | 中文

在 DSH Web 中运行兼容 Codex `pet.json` 协议的动画宠物。插件默认扫描 `~/.codex/pets/*/pet.json`，并内置嘉然作为兜底资源。

## 安装

```sh
cd /path/to/deepseek-harness-desktop
pnpm dsh plugin --profile web add ./plugins/codex-pets
pnpm dsh web
```

点击宠物会挥手，悬停会跳跃，左右拖动时会朝对应方向奔跑，双击会跳跃并回到右下角。右键宠物可循环切换已发现的宠物。

## 添加宠物

一个宠物目录至少包含：

```text
my-pet/
├── pet.json
└── spritesheet.webp
```

`pet.json` 使用 Codex 格式：

```json
{
  "id": "my-pet",
  "displayName": "My pet",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.webp"
}
```

将完整目录放入 `~/.codex/pets/<pet-name>/` 后重启 DSH，无需修改 Desktop 或插件源码。这与 Codex 的安装目录和 manifest 格式相同。支持 v1（8×9）和 v2（8×11）图集；标准动作行依次为 idle、running-right、running-left、waving、jumping、failed、waiting、running、review。

## 配置

打开“设置 → 插件 → 插件配置”即可管理本插件。配置卡可以显示或隐藏桌面宠物、选择任意已发现的 Codex 宠物，并将大小调整为 50% 到 200%。这些值属于 `codex-pets`，会以该 namespace 保存在 profile 设置文档中。

在 profile 的 `cordis.patch.yml` 中覆盖插件配置：

```yaml
- id: codex-pets
  config:
    activePet: my-pet
    codexPetsRoot: /path/to/codex/pets
    petDirectories:
      - /path/to/another-pet
```

- `activePet`：启动时默认显示的宠物 ID。
- `codexPetsRoot`：自动扫描的宠物根目录，默认 `~/.codex/pets`。
- `petDirectories`：额外的独立宠物目录。

卸载插件时配置卡会一并移除；`codex-pets` 设置分节也会被清理，其他插件和产品设置保持不变。

## 会话活动

宠物旁的数字 badge 显示活动会话数量。点击 badge 展开活动列表，包含当前或后台运行、等待输入、等待计划评审和未读完成的会话；点击一行会在 DSH 中打开对应会话。

## 状态映射

- 活动列表第一项正在运行：running。
- 活动列表第一项需要审批、提问或计划评审：waiting。
- 活动列表第一项是未读完成结果：review。
- 当前会话无活动但存在 Agent 错误：failed。
- 没有活动：idle。

动画帧数、逐帧时长、三轮动作后回到慢速 idle、活动优先级和拖动阈值均按 Codex 状态机实现。

## 卸载

```sh
cd /path/to/deepseek-harness-desktop
pnpm dsh plugin --profile web remove codex-pets
```

卸载后，Desktop 会销毁插件声明的透明窗口；主界面、设置与宠物目录均不会留下插件注入的状态。`~/.codex/pets` 中由用户安装的资源不会被删除。
