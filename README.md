# WebCatalog Enhancer

用于增强 Comike Web Catalog 的 Tampermonkey 用户脚本，将原有的三个独立脚本合并为一个统一脚本。

## 功能

- 收藏页面：从社团详情页动态取得 X/Twitter、Pixiv和主页地址，并覆盖条目中原有三个图标的点击功能。主页允许任意 HTTP/HTTPS 地址；X链接在详情页缺失或读取失败时回退到收藏备注，并将原有的 off 图标切换为 on。Pixiv或主页没有取得链接时保持原图标及原功能不变。
- 社团页面：生成可单击复制的摊位、社团及作者信息，并提供标准化为 `x.com` 的社交链接信息。
- 印刷页面：重组社团信息、支持单击复制，并导出包含摊位、社团、作者、备注、颜色和详情链接的 CSV 文件。

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 等用户脚本管理器。
2. [点击这里安装 WebCatalog Enhancer](https://raw.githubusercontent.com/uyuni-saline/webcatalog-enhancer/main/webcatalog-enhancer.user.js)。
3. 在用户脚本管理器显示安装页面后确认安装。

## 更新

脚本通过元数据中的 `@updateURL` 和 `@downloadURL` 获取更新。仓库中的脚本更新并提高 `@version` 后，用户脚本管理器会按照自身的检查周期自动发现新版本；也可以在管理器中手动检查更新。

## 开发

主要脚本文件为 [`webcatalog-enhancer.user.js`](./webcatalog-enhancer.user.js)。发布新版本时，请同步提高文件头部的 `@version`，并直接提交到 `main` 分支。

## 许可证

[MIT License](./LICENSE)
