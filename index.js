const { ethers } = require("ethers");
const { Keypair } = require("@solana/web3.js");
const { Ed25519Keypair } = require("@mysten/sui.js/keypairs/ed25519");
const bitcoin = require("bitcoinjs-lib");
const bip39 = require("bip39");
const TonWeb = require("tonweb");
const hdkey = require("hdkey");
const fs = require("fs");
const readline = require("readline");
const inquirer = require("inquirer");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");
const ECPair = ECPairFactory(ecc);

/**
 * 钱包信息类型定义
 * @typedef {Object} WalletInfo
 * @property {string} address - 钱包地址
 * @property {string} privateKey - 私钥
 * @property {string} [publicKey] - 公钥（某些链需要）
 * @property {string} [mnemonic] - 助记词（如果是从助记词生成）
 */

class MultiChainWalletGenerator {
  /**
   * 生成助记词
   * @param {number} strength - 助记词强度（128-256）
   * @returns {string} 助记词
   */
  static generateMnemonic(strength = 256) {
    return bip39.generateMnemonic(strength);
  }

  /**
   * 生成以太坊钱包
   * @param {string} [mnemonic] - 可选助记词
   * @returns {WalletInfo} 钱包信息
   */
  static generateEthereumWallet(mnemonic = null) {
    try {
      let wallet;
      if (mnemonic) {
        wallet = ethers.HDNodeWallet.fromPhrase(mnemonic);
      } else {
        wallet = ethers.Wallet.createRandom();
      }

      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        mnemonic: wallet.mnemonic?.phrase,
      };
    } catch (error) {
      throw new Error(`生成ETH钱包失败: ${error.message}`);
    }
  }

  /**
   * 生成比特币钱包
   * @param {string} [mnemonic] - 可选助记词
   * @param {string} [network='mainnet'] - 网络类型
   * @returns {WalletInfo} 钱包信息
   */
  static generateBitcoinWallet(mnemonic = null, network = "mainnet") {
    try {
      const networkConfig = bitcoin.networks[network];
      mnemonic = mnemonic || this.generateMnemonic();
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const root = hdkey.fromMasterSeed(seed);

      // 使用BIP44路径: m/44'/0'/0'/0/0
      const child = root.derive("m/44'/0'/0'/0/0");

      const keyPair = ECPair.fromPrivateKey(child.privateKey);
      const { address } = bitcoin.payments.p2pkh({
        pubkey: keyPair.publicKey,
        network: networkConfig,
      });

      return {
        address: address,
        privateKey: keyPair.privateKey.toString("hex"),
        publicKey: keyPair.publicKey.toString("hex"),
        mnemonic: mnemonic,
      };
    } catch (error) {
      throw new Error(`生成BTC钱包失败: ${error.message}`);
    }
  }

  /**
   * 生成Solana钱包
   * @returns {WalletInfo} 钱包信息
   */
  static generateSolanaWallet() {
    try {
      const keypair = Keypair.generate();
      return {
        address: keypair.publicKey.toString(),
        privateKey: Buffer.from(keypair.secretKey).toString("hex"),
        publicKey: keypair.publicKey.toString(),
      };
    } catch (error) {
      throw new Error(`生成SOL钱包失败: ${error.message}`);
    }
  }

  /**
   * 生成SUI钱包
   * @returns {WalletInfo} 钱包信息
   */
  static generateSuiWallet() {
    try {
      // 生成新的密钥对
      const keypair = new Ed25519Keypair();

      return {
        address: keypair.getPublicKey().toSuiAddress(),
        privateKey: keypair.export().privateKey,
        publicKey: keypair.getPublicKey().toBase64(),
      };
    } catch (error) {
      throw new Error(`生成SUI钱包失败: ${error.message}`);
    }
  }

  /**
   * 生成TON钱包
   * @returns {WalletInfo} 钱包信息
   */
  static async generateTonWallet() {
    try {
      const tonweb = new TonWeb(
        new TonWeb.HttpProvider("https://toncenter.com/api/v2/jsonRPC")
      );
      // 生成新的密钥对
      const keyPair = TonWeb.utils.nacl.sign.keyPair();
      const wallet = await tonweb.wallet.create({
        publicKey: keyPair.publicKey,
      });
      const address = await wallet.getAddress();

      return {
        address: address.toString(true, true, true),
        privateKey: Buffer.from(keyPair.secretKey.slice(0, 32)).toString("hex"),
        publicKey: Buffer.from(keyPair.publicKey).toString("hex"),
      };
    } catch (error) {
      throw new Error(`生成TON钱包失败: ${error.message}`);
    }
  }

  /**
   * 批量生成多链钱包
   * @param {number} count - 需要生成的钱包数量
   * @param {Array<string>} chains - 需要生成的链数组 ['BTC', 'ETH', 'SOL', 'SUI', 'TON']
   * @returns {Promise<Object>} 多链钱包信息
   */
  static async generateMultipleWallets(
    count = 1,
    chains = ["BTC", "ETH", "SOL", "SUI", "TON"]
  ) {
    const wallets = [];

    for (let i = 0; i < count; i++) {
      const walletGroup = {};
      const mnemonic = this.generateMnemonic();

      for (const chain of chains) {
        switch (chain.toUpperCase()) {
          case "BTC":
            walletGroup.BTC = this.generateBitcoinWallet(mnemonic);
            break;
          case "ETH":
            walletGroup.ETH = this.generateEthereumWallet(mnemonic);
            break;
          case "SOL":
            walletGroup.SOL = this.generateSolanaWallet();
            break;
          case "SUI":
            walletGroup.SUI = this.generateSuiWallet();
            break;
          case "TON":
            walletGroup.TON = await this.generateTonWallet();
            break;
        }
      }

      wallets.push(walletGroup);
    }

    return wallets;
  }

  /**
   * 验证钱包地址格式
   * @param {string} address - 钱包地址
   * @param {string} chain - 链类型
   * @returns {boolean} 是否有效
   */
  static validateAddress(address, chain) {
    try {
      switch (chain.toUpperCase()) {
        case "ETH":
          return ethers.utils.isAddress(address);
        case "BTC":
          try {
            bitcoin.address.toOutputScript(address);
            return true;
          } catch (e) {
            return false;
          }
        case "SOL":
          return address.length === 44 || address.length === 43;
        case "SUI":
          return address.startsWith("0x") && address.length === 42;
        case "TON":
          return TonWeb.Address.isValid(address);
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * 将钱包信息保存到不同文件
   * @param {Array<Object>} wallets - 钱包信息数组
   * @param {Array<string>} chains - 链类型数组
   */
  static saveWalletsToFiles(wallets, chains) {
    try {
      let addressContent = "";
      let privateKeyContent = "";
      let mnemonicContent = "";

      // 为每条链创建单独的部分
      chains.forEach((chain) => {
        // 地址文件内容
        addressContent += `\n=============== ${chain} Addresses ===============\n\n`;
        wallets.forEach((walletGroup) => {
          const wallet = walletGroup[chain];
          addressContent += `${wallet.address}\n`;
        });

        // 私钥文件内容
        privateKeyContent += `\n=============== ${chain} Private Keys ===============\n\n`;
        wallets.forEach((walletGroup) => {
          const wallet = walletGroup[chain];
          privateKeyContent += `${wallet.privateKey}\n`;
        });

        // 助记词文件内容（如果有）
        if (wallets.some((w) => w[chain].mnemonic)) {
          mnemonicContent += `\n=============== ${chain} Mnemonics ===============\n\n`;
          wallets.forEach((walletGroup) => {
            const wallet = walletGroup[chain];
            if (wallet.mnemonic) {
              mnemonicContent += `${wallet.mnemonic}\n`;
            }
          });
        }
      });

      // 保存到不同文件
      fs.writeFileSync("wallets.txt", addressContent);
      fs.writeFileSync("private_keys.txt", privateKeyContent);
      if (mnemonicContent) {
        fs.writeFileSync("mnemonic.txt", mnemonicContent);
      }

      console.log("钱包信息已保存到以下文件：");
      console.log("- wallets.txt (地址)");
      console.log("- private_keys.txt (私钥)");
      if (mnemonicContent) {
        console.log("- mnemonic.txt (助记词)");
      }
    } catch (error) {
      console.error("保存钱包信息失败:", error);
    }
  }
}

/**
 * 命令行交互函数
 * @returns {Promise<{chains: string[], count: number}>}
 */
async function promptUser() {
  try {
    // 使用inquirer进行链类型选择
    const chainsAnswer = await inquirer.prompt([
      {
        type: "checkbox",
        name: "chains",
        message: "请选择要生成的链类型（空格键选择，回车确认）:",
        choices: [
          { name: "Bitcoin (BTC)", value: "BTC" },
          { name: "Ethereum (ETH)", value: "ETH" },
          { name: "Solana (SOL)", value: "SOL" },
          { name: "SUI", value: "SUI" },
          { name: "TON", value: "TON" },
        ],
        validate: (answer) => {
          if (answer.length < 1) {
            return "请至少选择一个链类型";
          }
          return true;
        },
      },
    ]);

    // 输入钱包数量
    const countAnswer = await inquirer.prompt([
      {
        type: "number",
        name: "count",
        message: "请输入要生成的钱包数量:",
        validate: (value) => {
          const valid = !isNaN(value) && value > 0 && Number.isInteger(value);
          return valid || "请输入有效的正整数";
        },
      },
    ]);

    return {
      chains: chainsAnswer.chains,
      count: countAnswer.count,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 获取用户输入
    const { chains, count } = await promptUser();

    console.log(`\n开始生成 ${count} 个钱包，链类型: ${chains.join(", ")}`);

    // 生成钱包
    const wallets = await MultiChainWalletGenerator.generateMultipleWallets(
      count,
      chains
    );

    // 保存到不同文件
    MultiChainWalletGenerator.saveWalletsToFiles(wallets, chains);

    console.log("\n钱包生成完成！");
  } catch (error) {
    console.error("错误:", error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行main函数
if (require.main === module) {
  main();
}

// 导出类和函数
module.exports = {
  MultiChainWalletGenerator,
  main,
};
