const { MultiChainWalletGenerator } = require("../index.js");
const chalk = require("chalk");

console.log(chalk.blue("=== 测试更新后的比特币钱包生成 ==="));

async function testBtcWallets() {
  try {
    // 使用相同的助记词测试4种不同的地址类型
    const mnemonic = MultiChainWalletGenerator.generateMnemonic();
    console.log(chalk.cyan("助记词:"), mnemonic);

    const types = [
      { type: "legacy", name: "Legacy (1开头)" },
      // { type: "segwit", name: "P2SH-SegWit (3开头)" },
      { type: "nativesegwit", name: "Native SegWit (bc1q开头)" },
      { type: "taproot", name: "Taproot (bc1p开头)" },
    ];

    for (const { type, name } of types) {
      console.log(chalk.yellow(`\n生成 ${name} 地址:`));
      const wallet = MultiChainWalletGenerator.generateBitcoinWallet(
        mnemonic,
        "mainnet",
        type
      );

      console.log(chalk.green("- 地址:"), wallet.address);
      console.log(chalk.green("- 私钥 (WIF):"), wallet.privateKey);
      console.log(chalk.green("- 地址类型:"), wallet.addressType);

      // 验证地址格式
      const isValid = MultiChainWalletGenerator.validateAddress(
        wallet.address,
        "BTC"
      );
      console.log(chalk.green("- 地址验证:"), isValid ? "有效" : "无效");
    }

    console.log(chalk.blue("\n=== 测试完成 ==="));
  } catch (error) {
    console.error(chalk.red("测试失败:"), error.message);
    console.error(error.stack);
  }
}

testBtcWallets();
