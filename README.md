# WebCatalog Enhancer

用于增强 Comike Web Catalog 的 Tampermonkey 用户脚本，将原有的三个独立脚本合并为一个统一脚本。

## 功能

- 收藏页面：从社团详情页动态取得摊位、场馆、社团、作者、X/Twitter、Pixiv、主页、Melonbooks和BOOTH信息，并将社团名链接替换为包含场馆编号的完整文本。移除Niconico与CLIP STUDIO按钮；在主页按钮后按详情页实际信息追加Melonbooks和BOOTH标准链接，没有对应链接时不添加。X、Pixiv和主页图标同样会转换为标准链接，支持鼠标中键打开、右键复制链接等浏览器原生操作。主页允许任意HTTP/HTTPS地址；X链接在详情页缺失或读取失败时回退到收藏备注，并将原有的off图标切换为on。Pixiv或主页没有取得链接时保持原图标及原功能不变。
- 社团页面：根据第1日/第2日的独立摊位映射，在东、西、南区域后补充具体场馆编号，并生成可单击复制的摊位、社团及作者信息。原有全角摊位字母和a/b侧标保持不变；无法匹配时以 `?` 标记场馆。页面同时提供标准化为 `x.com` 的社交链接信息。
- 印刷页面：使用按日映射补充具体场馆编号后重组社团信息、支持单击复制，并导出包含带场馆编号摊位、社团、作者、备注、颜色和详情链接的 CSV 文件。

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
