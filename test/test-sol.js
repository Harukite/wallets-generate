const { MultiChainWalletGenerator } = require("../index.js");
const { Keypair } = require("@solana/web3.js");
const chalk = require("chalk");
const bs58 = require("bs58");

console.log(chalk.green("测试 Solana 钱包生成功能"));

try {
  // 生成SOL钱包
  const wallet = MultiChainWalletGenerator.generateSolanaWallet();

  // 输出钱包信息
  console.log(chalk.green("成功生成 Solana 钱包:"));
  console.log(chalk.cyan("- 地址:"), wallet.address);
  console.log(
    chalk.cyan("- 私钥 (base64):"),
    wallet.privateKey.substring(0, 15) + "..."
  );

  // 验证地址格式
  console.log(chalk.cyan("\n验证地址格式是否正确:"));
  const isValid = MultiChainWalletGenerator.validateAddress(
    wallet.address,
    "SOL"
  );
  console.log(chalk.green("验证结果:", isValid ? "有效" : "无效"));

  // 测试导入私钥
  console.log(chalk.cyan("\n测试从私钥恢复钱包:"));

  // 将base64私钥转换为Uint8Array
  const secretKeyUint8Array = Buffer.from(wallet.privateKey, "base64");

  // 从私钥创建Keypair
  const recoveredKeypair = Keypair.fromSecretKey(secretKeyUint8Array);

  // 检查恢复的公钥是否与原始公钥匹配
  const recoveredAddress = recoveredKeypair.publicKey.toBase58();
  console.log(chalk.cyan("- 恢复的地址:"), recoveredAddress);
  console.log(
    chalk.green("地址匹配:", recoveredAddress === wallet.address ? "是" : "否")
  );

  console.log(chalk.green("\n测试完成!"));
} catch (error) {
  console.error(chalk.red("测试失败:"), error.message);
  console.error(error.stack);
}
