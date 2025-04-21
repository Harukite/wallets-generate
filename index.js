const { ethers } = require("ethers");
const { Keypair, PublicKey } = require("@solana/web3.js");
const { Ed25519Keypair } = require("@mysten/sui/keypairs/ed25519");
const bitcoin = require("bitcoinjs-lib");
const bip39 = require("bip39");
const hdkey = require("hdkey");
const fs = require("fs");
const readline = require("readline");
const inquirer = require("inquirer");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");
const { BIP32Factory } = require("bip32");
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);
const chalk = require("chalk");
const { isValidSuiAddress } = require("@mysten/sui/utils");
const bs58 = require("bs58").default;

// 初始化bitcoinjs-lib的ECC库，解决Taproot地址生成问题
bitcoin.initEccLib(ecc);

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
   * @param {string} [addressType='segwit'] - 地址类型: 'legacy', 'segwit', 'taproot'
   * @returns {WalletInfo} 钱包信息
   */
  static generateBitcoinWallet(
    mnemonic = null,
    network = "mainnet",
    addressType = "segwit"
  ) {
    try {
      // 确保使用正确的网络配置
      const networkConfig = bitcoin.networks[network];

      // 使用提供的助记词或生成新的
      mnemonic = mnemonic || this.generateMnemonic();

      // 从助记词生成种子
      const seed = bip39.mnemonicToSeedSync(mnemonic);

      // 从种子生成HD钱包
      const root = bip32.fromSeed(seed);

      // 定义不同地址类型的派生路径
      const paths = {
        // legacy: "m/44'/0'/0'/0/0", // Legacy (P2PKH) - 1开头
        // segwit: "m/49'/0'/0'/0/0", // P2SH-SegWit - 3开头
        nativeSegwit: "m/84'/0'/0'/0/0", // Native SegWit (P2WPKH) - bc1q开头
        taproot: "m/86'/0'/0'/0/0", // Taproot (P2TR) - bc1p开头
      };

      let address, publicKey, privateKey, wifPrivateKey;

      // 根据地址类型生成对应的钱包
      switch (addressType.toLowerCase()) {
        // case "legacy": // 传统地址 (P2PKH) - 1开头
        //   const legacyNode = root.derivePath(paths.legacy);
        //   const legacyPrivateKeyBuffer = Buffer.from(legacyNode.privateKey);
        //   const legacyKeyPair = ECPair.fromPrivateKey(legacyPrivateKeyBuffer, {
        //     network: networkConfig,
        //   });
        //   const legacyPayment = bitcoin.payments.p2pkh({
        //     pubkey: legacyKeyPair.publicKey,
        //     network: networkConfig,
        //   });
        //   address = legacyPayment.address;
        //   publicKey = legacyKeyPair.publicKey;
        //   privateKey = legacyPrivateKeyBuffer;
        //   wifPrivateKey = legacyKeyPair.toWIF();
        //   break;

        // case "segwit": // P2SH-SegWit地址 (兼容格式) - 3开头
        //   const segwitNode = root.derivePath(paths.segwit);
        //   const segwitPrivateKeyBuffer = Buffer.from(segwitNode.privateKey);
        //   const segwitKeyPair = ECPair.fromPrivateKey(segwitPrivateKeyBuffer, {
        //     network: networkConfig,
        //   });

        //   // 创建P2WPKH (见证脚本)
        //   const p2wpkh = bitcoin.payments.p2wpkh({
        //     pubkey: segwitKeyPair.publicKey,
        //     network: networkConfig,
        //   });

        //   // 将P2WPKH嵌套在P2SH中
        //   const p2shPayment = bitcoin.payments.p2sh({
        //     redeem: p2wpkh,
        //     network: networkConfig,
        //   });

        //   address = p2shPayment.address;
        //   publicKey = segwitKeyPair.publicKey;
        //   privateKey = segwitPrivateKeyBuffer;
        //   wifPrivateKey = segwitKeyPair.toWIF();
        //   break;

        case "nativesegwit": // 原生隔离见证地址 (P2WPKH) - bc1q开头
        case "native-segwit":
          const nativeSegwitNode = root.derivePath(paths.nativeSegwit);
          const nativeSegwitPrivateKeyBuffer = Buffer.from(
            nativeSegwitNode.privateKey
          );
          const nativeSegwitKeyPair = ECPair.fromPrivateKey(
            nativeSegwitPrivateKeyBuffer,
            {
              network: networkConfig,
            }
          );
          const nativeSegwitPayment = bitcoin.payments.p2wpkh({
            pubkey: nativeSegwitKeyPair.publicKey,
            network: networkConfig,
          });
          address = nativeSegwitPayment.address;
          publicKey = nativeSegwitKeyPair.publicKey;
          privateKey = nativeSegwitPrivateKeyBuffer;
          wifPrivateKey = nativeSegwitKeyPair.toWIF();
          break;

        case "taproot": // Taproot地址 (P2TR) - bc1p开头
          const taprootNode = root.derivePath(paths.taproot);
          const taprootPrivateKeyBuffer = Buffer.from(taprootNode.privateKey);
          const taprootKeyPair = ECPair.fromPrivateKey(
            taprootPrivateKeyBuffer,
            {
              network: networkConfig,
            }
          );
          const { address: taprootAddress } = bitcoin.payments.p2tr({
            internalPubkey: taprootKeyPair.publicKey.slice(1, 33),
            network: networkConfig,
          });
          address = taprootAddress;
          publicKey = taprootKeyPair.publicKey;
          privateKey = taprootPrivateKeyBuffer;
          wifPrivateKey = taprootKeyPair.toWIF();
          break;

        default:
          throw new Error(`不支持的地址类型: ${addressType}`);
      }

      // 确保地址不为空
      if (!address) {
        throw new Error("生成比特币地址失败");
      }

      // 验证地址前缀
      if (
        (addressType === "taproot" && !address.startsWith("bc1p")) ||
        (addressType === "nativesegwit" && !address.startsWith("bc1q")) ||
        (addressType === "native-segwit" && !address.startsWith("bc1q")) ||
        (addressType === "segwit" && !address.startsWith("3"))
        // (addressType === "legacy" && !address.startsWith("1"))
      ) {
        throw new Error(`${addressType}地址格式不正确: ${address}`);
      }

      // 保持原有输出格式
      return {
        address: address,
        privateKey: wifPrivateKey, // 使用WIF格式的私钥
        publicKey: publicKey.toString("hex"),
        mnemonic: mnemonic,
        addressType: addressType,
      };
    } catch (error) {
      console.error("生成BTC钱包错误:", error);
      throw new Error(`生成BTC钱包失败: ${error.message}`);
    }
  }

  /**
   * 生成Solana钱包
   * @returns {WalletInfo} 钱包信息
   */
  static generateSolanaWallet() {
    try {
      // 创建新的密钥对
      const keypair = Keypair.generate();

      // 获取公钥（地址）- 使用base58编码
      const publicKey = keypair.publicKey.toBase58();

      // 使用bs58编码私钥 - 这是币安等大多数钱包支持的格式
      const privateKey = bs58.encode(keypair.secretKey);

      return {
        address: publicKey,
        privateKey: privateKey,
        publicKey: publicKey,
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
      // 使用 generate 静态方法创建新的密钥对
      const keypair = Ed25519Keypair.generate();

      return {
        address: keypair.getPublicKey().toSuiAddress(),
        // 获取私钥，这是 suiprivkey 格式，可直接导入到 SUI 钱包
        privateKey: keypair.getSecretKey(),
        // 获取公钥
        publicKey: keypair.getPublicKey().toBase64(),
      };
    } catch (error) {
      throw new Error(`生成SUI钱包失败: ${error.message}`);
    }
  }

  /**
   * 生成BNB链钱包
   * @param {string} [mnemonic] - 可选助记词
   * @returns {WalletInfo} 钱包信息
   */
  static generateBnbWallet(mnemonic = null) {
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
      throw new Error(`生成BNB钱包失败: ${error.message}`);
    }
  }

  /**
   * 从私钥导入SUI钱包
   * @param {string} privateKey - 私钥(suiprivkey格式)
   * @returns {WalletInfo} 钱包信息
   */
  static importSuiWallet(privateKey) {
    try {
      // 从 suiprivkey 格式的私钥导入密钥对
      const keypair = Ed25519Keypair.fromSecretKey(privateKey);

      return {
        address: keypair.getPublicKey().toSuiAddress(),
        privateKey: keypair.getSecretKey(),
        publicKey: keypair.getPublicKey().toBase64(),
      };
    } catch (error) {
      throw new Error(`导入SUI钱包失败: ${error.message}`);
    }
  }

  /**
   * 从私钥导入Solana钱包
   * @param {string} privateKey - base58编码的私钥
   * @returns {WalletInfo} 钱包信息
   */
  static importSolanaWallet(privateKey) {
    try {
      // 将base58格式的私钥解码为Uint8Array
      const secretKey = bs58.decode(privateKey);

      // 创建密钥对
      const keypair = Keypair.fromSecretKey(secretKey);

      // 获取公钥和地址
      const publicKey = keypair.publicKey.toBase58();

      return {
        address: publicKey,
        privateKey: privateKey, // 保持原始私钥格式
        publicKey: publicKey,
      };
    } catch (error) {
      throw new Error(`导入SOL钱包失败: ${error.message}`);
    }
  }

  /**
   * 批量生成多链钱包
   * @param {number} count - 需要生成的钱包数量
   * @param {Array<string>} chains - 需要生成的链数组 ['BTC', 'ETH', 'SOL', 'SUI', 'BNB']
   * @param {Object} options - 额外选项
   * @param {string} [options.btcAddressType='segwit'] - 比特币地址类型: 'legacy', 'segwit', 'nativesegwit', 'taproot'
   * @returns {Promise<Object>} 多链钱包信息
   */
  static async generateMultipleWallets(
    count = 1,
    chains = ["BTC", "ETH", "SOL", "SUI", "BNB"],
    options = { btcAddressType: "segwit" }
  ) {
    const wallets = [];
    let successCount = 0;
    let errorCount = 0;

    console.log(chalk.blue(`开始生成 ${count} 个多链钱包...`));
    if (chains.includes("BTC")) {
      let btcType = options.btcAddressType;

      // 格式化BTC地址类型显示名称
      let btcTypeDisplay = btcType;
      if (btcType === "nativesegwit")
        btcTypeDisplay = "Native SegWit (bc1q开头)";
      else if (btcType === "taproot") btcTypeDisplay = "Taproot (bc1p开头)";

      console.log(chalk.blue(`BTC地址类型: ${btcTypeDisplay}`));
    }

    for (let i = 0; i < count; i++) {
      const walletGroup = {};
      const mnemonic = this.generateMnemonic();
      let hasError = false;

      console.log(chalk.cyan(`生成钱包组 #${i + 1}/${count}`));

      for (const chain of chains) {
        try {
          switch (chain.toUpperCase()) {
            case "BTC":
              walletGroup.BTC = this.generateBitcoinWallet(
                mnemonic,
                "mainnet",
                options.btcAddressType
              );
              console.log(
                chalk.green(`✓ BTC 钱包生成成功 (${options.btcAddressType})`)
              );
              break;
            case "ETH":
              walletGroup.ETH = this.generateEthereumWallet(mnemonic);
              console.log(chalk.green(`✓ ETH 钱包生成成功`));
              break;
            case "SOL":
              walletGroup.SOL = this.generateSolanaWallet();
              console.log(chalk.green(`✓ SOL 钱包生成成功`));
              break;
            case "SUI":
              walletGroup.SUI = this.generateSuiWallet();
              console.log(chalk.green(`✓ SUI 钱包生成成功`));
              break;
            case "BNB":
              walletGroup.BNB = this.generateBnbWallet(mnemonic);
              console.log(chalk.green(`✓ BNB 钱包生成成功`));
              break;
          }
        } catch (error) {
          console.error(
            chalk.red(`✗ 生成 ${chain} 钱包失败: ${error.message}`)
          );
          hasError = true;
          // 记录错误但继续处理其他链
          walletGroup[chain] = {
            address: "生成失败",
            privateKey: "生成失败",
            publicKey: "生成失败",
            error: error.message,
          };
          errorCount++;
        }
      }

      wallets.push(walletGroup);
      if (!hasError) successCount++;
    }

    console.log(
      chalk.blue(
        `钱包生成完成! 成功: ${successCount}, 部分失败: ${count - successCount}`
      )
    );
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
        case "BNB":
          return ethers.isAddress(address);
        case "BTC":
          try {
            // 检查地址格式
            if (!address) return false;

            // 尝试解析地址，如果能解析成功则是有效地址
            bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
            return true;
          } catch (e) {
            return false;
          }
        case "SOL":
          try {
            new PublicKey(address);
            return true;
          } catch (e) {
            return false;
          }
        case "SUI":
          return isValidSuiAddress(address);
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
          // 跳过生成失败的钱包
          if (wallet.address === "生成失败") return;
          addressContent += `${wallet.address}\n`;
        });

        // 私钥文件内容
        privateKeyContent += `\n=============== ${chain} Private Keys ===============\n\n`;
        wallets.forEach((walletGroup) => {
          const wallet = walletGroup[chain];
          // 跳过生成失败的钱包
          if (wallet.privateKey === "生成失败") return;
          privateKeyContent += `${wallet.privateKey}\n`;
        });

        // 助记词文件内容（如果有）
        if (wallets.some((w) => w[chain]?.mnemonic)) {
          mnemonicContent += `\n=============== ${chain} Mnemonics ===============\n\n`;
          wallets.forEach((walletGroup) => {
            const wallet = walletGroup[chain];
            if (wallet?.mnemonic) {
              mnemonicContent += `${wallet.mnemonic}\n`;
            }
          });
        }
      });

      // 创建wallets目录（如果不存在）
      const walletsDir = "wallets";
      if (!fs.existsSync(walletsDir)) {
        fs.mkdirSync(walletsDir, { recursive: true });
      }

      // 保存到wallets目录下的不同文件
      fs.writeFileSync(`${walletsDir}/wallets.txt`, addressContent);
      fs.writeFileSync(`${walletsDir}/private_keys.txt`, privateKeyContent);
      if (mnemonicContent) {
        fs.writeFileSync(`${walletsDir}/mnemonic.txt`, mnemonicContent);
      }

      console.log(chalk.blue("钱包信息已保存到以下文件："));
      console.log(chalk.blue(`- ${walletsDir}/wallets.txt (地址)`));
      console.log(chalk.blue(`- ${walletsDir}/private_keys.txt (私钥)`));
      if (mnemonicContent) {
        console.log(chalk.blue(`- ${walletsDir}/mnemonic.txt (助记词)`));
      }
    } catch (error) {
      console.log(chalk.red("保存钱包信息失败:", error));
    }
  }

  /**
   * 从助记词导入多链钱包
   * @param {string} mnemonic - 助记词
   * @param {Array<string>} chains - 需要导入的链数组 ['BTC', 'ETH', 'BNB']
   * @param {Object} options - 额外选项
   * @param {string} [options.btcAddressType='segwit'] - 比特币地址类型: 'legacy', 'segwit', 'nativesegwit', 'taproot'
   * @returns {Promise<Object>} 钱包信息
   */
  static async importWalletFromMnemonic(
    mnemonic,
    chains,
    options = { btcAddressType: "segwit" }
  ) {
    try {
      const walletGroup = {};

      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error("无效的助记词");
      }

      for (const chain of chains) {
        try {
          switch (chain.toUpperCase()) {
            case "BTC":
              walletGroup.BTC = this.generateBitcoinWallet(
                mnemonic,
                "mainnet",
                options.btcAddressType
              );
              console.log(
                chalk.green(`✓ BTC 钱包导入成功 (${options.btcAddressType})`)
              );
              break;
            case "ETH":
              walletGroup.ETH = this.generateEthereumWallet(mnemonic);
              console.log(chalk.green(`✓ ETH 钱包导入成功`));
              break;
            case "BNB":
              walletGroup.BNB = this.generateBnbWallet(mnemonic);
              console.log(chalk.green(`✓ BNB 钱包导入成功`));
              break;
            case "SOL":
              // 从助记词生成Solana钱包
              const seed = await bip39.mnemonicToSeed(mnemonic);
              const derivedSeed = seed.slice(0, 32);
              const keypair = Keypair.fromSeed(derivedSeed);
              walletGroup.SOL = {
                address: keypair.publicKey.toBase58(),
                privateKey: bs58.encode(keypair.secretKey),
                publicKey: keypair.publicKey.toBase58(),
                mnemonic: mnemonic,
              };
              console.log(chalk.green(`✓ SOL 钱包导入成功`));
              break;
            default:
              throw new Error(`不支持从助记词导入 ${chain} 钱包`);
          }
        } catch (error) {
          console.error(
            chalk.red(`✗ 导入 ${chain} 钱包失败: ${error.message}`)
          );
          walletGroup[chain] = {
            address: "导入失败",
            privateKey: "导入失败",
            publicKey: "导入失败",
            error: error.message,
          };
        }
      }

      return walletGroup;
    } catch (error) {
      throw new Error(`从助记词导入钱包失败: ${error.message}`);
    }
  }
}

/**
 * 命令行交互函数
 * @returns {Promise<{chains: string[], count: number, btcAddressType: string}>}
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
          { name: "BNB Chain (BNB)", value: "BNB" },
        ],
        validate: (answer) => {
          if (answer.length < 1) {
            return "请至少选择一个链类型";
          }
          return true;
        },
      },
    ]);

    // 如果选择了BTC，询问地址类型
    let btcAddressType = "segwit"; // 默认
    if (chainsAnswer.chains.includes("BTC")) {
      const btcTypeAnswer = await inquirer.prompt([
        {
          type: "list",
          name: "btcAddressType",
          message: "请选择比特币地址类型:",
          choices: [
            // { name: "P2SH-SegWit (3开头) - 兼容格式", value: "segwit" },
            { name: "Taproot (bc1p开头) - 最新格式", value: "taproot" },
            {
              name: "Native SegWit (bc1q开头) - 低手续费",
              value: "nativesegwit",
            },
            // { name: "Legacy (1开头) - 传统格式", value: "legacy" },
          ],
          default: "taproot",
        },
      ]);
      btcAddressType = btcTypeAnswer.btcAddressType;
    }

    // 输入钱包数量
    const countAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "count",
        message: "请输入要生成的钱包数量:",
        validate: (value) => {
          // 转换输入为数字
          const numValue = parseInt(value, 10);
          // 验证是否为有效正整数
          const valid =
            !isNaN(numValue) && numValue > 0 && Number.isInteger(numValue);
          return valid || "请输入有效的正整数";
        },
        filter: (value) => {
          // 过滤函数：如果输入无效，返回空字符串以清除输入
          const numValue = parseInt(value, 10);
          return !isNaN(numValue) && numValue > 0 && Number.isInteger(numValue)
            ? numValue
            : "";
        },
      },
    ]);

    return {
      chains: chainsAnswer.chains,
      count: parseInt(countAnswer.count, 10),
      btcAddressType: btcAddressType,
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
    const { chains, count, btcAddressType } = await promptUser();

    console.log(
      chalk.green(`\n开始生成 ${count} 个钱包，链类型: ${chains.join(", ")}`)
    );

    if (chains.includes("BTC")) {
      console.log(chalk.green(`比特币地址类型: ${btcAddressType}`));
    }

    // 生成钱包
    const wallets = await MultiChainWalletGenerator.generateMultipleWallets(
      count,
      chains,
      { btcAddressType }
    );

    // 保存到不同文件
    MultiChainWalletGenerator.saveWalletsToFiles(wallets, chains);

    console.log(chalk.green("\n钱包生成完成！"));
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
