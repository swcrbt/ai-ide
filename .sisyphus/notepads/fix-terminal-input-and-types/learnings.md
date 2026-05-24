## 修复 GetSettings/SaveSettings 类型不匹配

### 问题
Go 后端返回 JSON 字符串，前端用 JSON.parse 解析。运行时 Wails 可能直接返回对象，导致 JSON.parse 失败。

### 修复方案
1. 修改 app.go：GetSettings 返回 config.Settings，SaveSettings 接受 config.Settings，移除 json.Marshal/Unmarshal
2. 运行 wails generate module 重新生成前端绑定
3. 前端 stores 直接使用返回的 config.Settings 对象，无需 JSON.parse/stringify

### 类型兼容性处理
- Wails 生成的 config.Settings 是一个类，包含 convertValues 方法
- 前端原有的 AppSettings 是接口，不能直接赋值给 config.Settings
- 解决方案：在 useAppStore 中使用 config.Settings.createFrom() 转换
- saveSettings 参数保持 AppSettings 类型（兼容 SettingsPanel 等组件），内部用 createFrom 转换

### 注意
- wails generate module 生成绑定时需要 app.go 正确编译通过
- TypeScript 缓存可能导致旧类型被使用，清除缓存：rm -rf node_modules/.cache
