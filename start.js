// 启动脚本，用于禁用 punycode 弃用警告
// 通过环境变量禁用特定的弃用警告
process.env.NODE_NO_WARNINGS = 1;

// 导入主程序
const { main } = require("./index.js");

// 运行主程序
main().catch((error) => {
  console.error("程序执行错误:", error);
  process.exit(1);
});
