const { MultiChainWalletGenerator } = require("../index.js");
const chalk = require("chalk");
console.log(chalk.green("测试 SUI 钱包生成功能"));

try {
  const wallet = MultiChainWalletGenerator.generateSuiWallet();
  console.log(chalk.green("成功生成 SUI 钱包:"));
  console.log(chalk.cyan("- 地址:"), wallet.address);
  console.log(
    chalk.cyan("- 私钥:"),
    wallet.privateKey.substring(0, 10) + "..."
  );
  console.log(chalk.cyan("- 公钥:"), wallet.publicKey.substring(0, 10) + "...");
  console.log(chalk.cyan("\n验证地址格式是否正确:"));
  const isValid = MultiChainWalletGenerator.validateAddress(
    wallet.address,
    "SUI"
  );
  console.log(chalk.green("验证结果:", isValid ? "有效" : "无效"));

  console.log(chalk.green("\n测试完成!"));
} catch (error) {
  console.error(chalk.red("测试失败:"), error.message);
  console.error(error.stack);
}
