// ========================
// Markdown 配置
// ========================

// 配置 marked.js
marked.setOptions({
    breaks: true,      // 将单个换行符转换为 <br>
    gfm: true,         // 启用 GitHub 风格的 Markdown
    headerIds: false,  // 禁用标题 ID
    mangle: false,     // 禁用邮箱地址混淆
    highlight: function(code, lang) {
        // 使用 highlight.js 进行代码高亮
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (err) {
                console.error('语法高亮失败:', err);
            }
        }
        return hljs.highlightAuto(code).value;
    }
});
