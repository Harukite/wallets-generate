const { ethers } = require("ethers");
const {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} = require("@solana/web3.js");
const { MultiChainWalletGenerator } = require("../index");
const chalk = require("chalk");
const inquirer = require("inquirer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// 添加网络配置对象
const networkConfigs = {
  ethereum: {
    mainnet: {
      rpcUrl: "https://ethereum.publicnode.com",
      name: "以太坊主网",
    },
    goerli: {
      rpcUrl: "https://ethereum-goerli.publicnode.com",
      name: "Goerli测试网",
    },
    sepolia: {
      rpcUrl: "https://ethereum-sepolia.publicnode.com",
      name: "Sepolia测试网",
    },
  },
  bnb: {
    mainnet: {
      rpcUrl: "https://bsc.publicnode.com",
      name: "BNB Chain主网",
    },
    testnet: {
      rpcUrl: "https://bsc-testnet.publicnode.com",
      name: "BNB Chain测试网",
    },
  },
  bitcoin: {
    mainnet: {
      apiUrl: "https://blockstream.info/api",
      name: "比特币主网",
    },
    testnet: {
      apiUrl: "https://blockstream.info/testnet/api",
      name: "比特币测试网",
    },
  },
  solana: {
    mainnet: {
      cluster: "mainnet-beta",
      name: "Solana主网",
    },
    testnet: {
      cluster: "testnet",
      name: "Solana测试网",
    },
    devnet: {
      cluster: "devnet",
      name: "Solana Devnet",
    },
  },
  sui: {
    mainnet: {
      rpcUrl: "https://fullnode.mainnet.sui.io/",
      name: "SUI主网",
    },
    testnet: {
      rpcUrl: "https://fullnode.testnet.sui.io/",
      name: "SUI测试网",
    },
    devnet: {
      rpcUrl: "https://fullnode.devnet.sui.io/",
      name: "SUI Devnet",
    },
  },
};

// 添加用户配置
let userNetworkConfig = {
  ethereum: "goerli",
  bnb: "testnet",
  bitcoin: "testnet",
  solana: "devnet",
  sui: "devnet",
};

/**
 * 处理命令行参数
 * @returns {Object} 命令行参数
 */
function parseCommandLine() {
  const args = process.argv.slice(2);
  const params = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--chain" && i + 1 < args.length) {
      params.chain = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === "--address" && i + 1 < args.length) {
      params.address = args[i + 1];
      i++;
    } else if (args[i] === "--help") {
      params.help = true;
    } else if (args[i] === "--generate") {
      params.generate = true;
    } else if (args[i] === "--network" && i + 1 < args.length) {
      params.network = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === "--config") {
      params.showConfig = true;
    } else if (args[i] === "--file" && i + 1 < args.length) {
      params.file = args[i + 1];
      i++;
    } else if (args[i] === "--batch") {
      params.batch = true;
    } else if (args[i] === "--output" && i + 1 < args.length) {
      params.output = args[i + 1];
      i++;
    }
  }

  return params;
}

/**
 * 显示命令行帮助信息
 */
function showHelp() {
  console.log(chalk.green("===== 多链钱包地址测试网验证工具 =====\n"));
  console.log("用法:");
  console.log("  node test-addresses.js                  - 交互式操作");
  console.log("  node test-addresses.js --generate       - 生成新钱包并验证");
  console.log(
    "  node test-addresses.js --chain BTC --address <地址>  - 验证特定链的特定地址"
  );
  console.log(
    "  node test-addresses.js --chain ETH --address <地址> --network mainnet  - 在特定网络验证地址"
  );
  console.log("  node test-addresses.js --config         - 显示当前网络配置");
  console.log(
    "  node test-addresses.js --batch --chain SOL --file addresses.txt --network mainnet  - 批量验证文件中的地址"
  );
  console.log("\n选项:");
  console.log("  --help                    显示帮助信息");
  console.log("  --generate                生成新钱包并验证");
  console.log("  --chain <链类型>          指定链类型 (BTC/ETH/SOL/SUI/BNB)");
  console.log("  --address <地址>          指定要验证的地址");
  console.log(
    "  --network <网络类型>      指定网络类型 (mainnet/testnet/devnet等)"
  );
  console.log("  --config                  显示当前网络配置");
  console.log("  --batch                   批量验证地址模式");
  console.log(
    "  --file <文件路径>         指定包含地址列表的文件，每行一个地址"
  );
  console.log("  --output <文件路径>       指定输出结果的文件路径");
  console.log("\n支持的网络类型:");
  console.log("  ETH: mainnet, goerli, sepolia");
  console.log("  BNB: mainnet, testnet");
  console.log("  BTC: mainnet, testnet");
  console.log("  SOL: mainnet, testnet, devnet");
  console.log("  SUI: mainnet, testnet, devnet");
  console.log("\n示例:");
  console.log(
    "  node test-addresses.js --chain BTC --address bc1q... --network mainnet"
  );
  console.log(
    "  node test-addresses.js --chain SOL --address Gr5TMB... --network devnet"
  );
  console.log(
    "  node test-addresses.js --batch --chain SOL --file solana_addresses.txt --network mainnet"
  );
}

/**
 * 显示当前网络配置
 */
function showNetworkConfig() {
  console.log(chalk.green("===== 当前网络配置 =====\n"));
  console.log(
    "以太坊 (ETH):",
    networkConfigs.ethereum[userNetworkConfig.ethereum].name
  );
  console.log("BNB Chain:", networkConfigs.bnb[userNetworkConfig.bnb].name);
  console.log(
    "比特币 (BTC):",
    networkConfigs.bitcoin[userNetworkConfig.bitcoin].name
  );
  console.log(
    "Solana (SOL):",
    networkConfigs.solana[userNetworkConfig.solana].name
  );
  console.log("SUI:", networkConfigs.sui[userNetworkConfig.sui].name);

  console.log("\n可以通过 --network 参数修改特定验证的网络类型");
  console.log(
    "示例: node test-addresses.js --chain ETH --address 0x... --network mainnet"
  );
}

/**
 * 从文件中读取地址列表
 * @param {string} filePath - 文件路径
 * @returns {Promise<Array<string>>} 地址数组
 */
async function readAddressesFromFile(filePath) {
  try {
    // 确保文件存在
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const addresses = [];

    // 创建文件读取流
    const fileStream = fs.createReadStream(filePath);

    // 创建readline接口
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // 逐行读取地址
    for await (const line of rl) {
      // 跳过空行和注释行
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith("#")) {
        addresses.push(trimmedLine);
      }
    }

    return addresses;
  } catch (error) {
    throw new Error(`读取地址文件失败: ${error.message}`);
  }
}

/**
 * 保存验证结果到文件
 * @param {Array<Object>} results - 验证结果数组
 * @param {string} filePath - 输出文件路径
 * @param {string} chain - 链类型
 * @param {string} networkType - 网络类型
 */
function saveResultsToFile(results, filePath, chain, networkType) {
  try {
    // 计算统计信息
    const totalAddresses = results.length;
    const validAddresses = results.filter((r) => r.valid).length;
    const invalidAddresses = totalAddresses - validAddresses;

    // 准备输出内容
    let output = `===== 多链钱包地址验证结果 =====\n\n`;
    output += `链类型: ${chain}\n`;

    // 获取网络名称
    let networkName = "";
    switch (chain) {
      case "ETH":
        networkName = networkConfigs.ethereum[networkType].name;
        break;
      case "BNB":
        networkName = networkConfigs.bnb[networkType].name;
        break;
      case "BTC":
        networkName = networkConfigs.bitcoin[networkType].name;
        break;
      case "SOL":
        networkName = networkConfigs.solana[networkType].name;
        break;
      case "SUI":
        networkName = networkConfigs.sui[networkType].name;
        break;
    }

    output += `网络: ${networkName}\n`;
    output += `验证时间: ${new Date().toLocaleString()}\n\n`;
    output += `总地址数: ${totalAddresses}\n`;
    output += `有效地址: ${validAddresses}\n`;
    output += `无效地址: ${invalidAddresses}\n\n`;

    // 添加详细结果
    output += `===== 详细结果 =====\n\n`;

    // 先输出有效地址
    output += `--- 有效地址 ---\n\n`;
    results
      .filter((r) => r.valid)
      .forEach((result, index) => {
        output += `${index + 1}. ${result.address}\n`;
        output += `   余额: ${result.balance}\n`;
        if (result.networkError) {
          output += `   注意: 无法连接到网络，但地址格式有效\n`;
        }
        output += `\n`;
      });

    // 再输出无效地址
    if (invalidAddresses > 0) {
      output += `--- 无效地址 ---\n\n`;
      results
        .filter((r) => !r.valid)
        .forEach((result, index) => {
          output += `${index + 1}. ${result.address}\n`;
          output += `   错误: ${result.error}\n`;
          output += `\n`;
        });
    }

    // 写入文件
    fs.writeFileSync(filePath, output);

    console.log(chalk.green(`\n验证结果已保存到文件: ${filePath}`));
  } catch (error) {
    console.error(chalk.red(`保存结果到文件失败: ${error.message}`));
  }
}

/**
 * 批量验证地址
 * @param {Array<string>} addresses - 地址数组
 * @param {string} chain - 链类型
 * @param {string} networkType - 网络类型
 * @returns {Promise<Array<Object>>} 验证结果数组
 */
async function batchValidateAddresses(addresses, chain, networkType) {
  console.log(chalk.blue(`开始批量验证${addresses.length}个${chain}地址...\n`));

  const results = [];

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    console.log(
      chalk.blue(`[${i + 1}/${addresses.length}] 正在验证地址: ${address}`)
    );

    try {
      const result = await AddressValidator.validateAddress(
        address,
        chain,
        networkType
      );

      // 添加地址到结果
      result.address = address;

      // 显示结果
      if (result.valid) {
        console.log(chalk.green(`✓ 有效 (${result.network})`));
        console.log(`地址: ${result.address} 余额: ${result.balance}`);
      } else {
        console.log(chalk.red(`✗ 无效: ${result.error}`));
      }

      results.push(result);
    } catch (error) {
      console.log(chalk.red(`✗ 验证失败: ${error.message}`));
      results.push({
        valid: false,
        address,
        error: error.message,
      });
    }

    // 添加间隔，避免API限制
    if (i < addresses.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}

/**
 * 在不同测试网上验证生成的钱包地址
 */
class AddressValidator {
  /**
   * 验证以太坊/BNB地址
   * @param {string} address - 钱包地址
   * @param {string} network - 网络名称 ("ethereum" 或 "bnb")
   * @param {string} networkType - 网络类型 ("mainnet", "testnet" 等)
   * @returns {Promise<object>} 验证结果
   */
  static async validateEthereumAddress(
    address,
    network = "ethereum",
    networkType = null
  ) {
    try {
      // 首先验证地址格式是否正确
      if (!ethers.isAddress(address)) {
        return {
          valid: false,
          error: "地址格式无效",
        };
      }

      // 如果未指定网络类型，使用默认配置
      if (!networkType) {
        networkType = userNetworkConfig[network];
      }

      // 选择合适的网络配置
      let networkConfig;
      if (network === "ethereum") {
        if (!networkConfigs.ethereum[networkType]) {
          return {
            valid: false,
            error: `不支持的以太坊网络类型: ${networkType}`,
          };
        }
        networkConfig = networkConfigs.ethereum[networkType];
      } else if (network === "bnb") {
        if (!networkConfigs.bnb[networkType]) {
          return {
            valid: false,
            error: `不支持的BNB网络类型: ${networkType}`,
          };
        }
        networkConfig = networkConfigs.bnb[networkType];
      } else {
        return {
          valid: false,
          error: `不支持的网络: ${network}`,
        };
      }

      try {
        // 设置超时
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`连接${networkConfig.name}超时`)),
            5000
          );
        });

        // 尝试连接
        const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

        // 等待提供者准备就绪或超时
        const networkPromise = provider.ready;
        await Promise.race([networkPromise, timeoutPromise]);

        // 获取地址余额
        const balance = await provider.getBalance(address);

        return {
          valid: true,
          network: networkConfig.name,
          balance: ethers.formatEther(balance),
          address,
        };
      } catch (netError) {
        // 网络连接错误，但地址格式正确，仍然返回有效
        return {
          valid: true,
          network: networkConfig.name,
          balance: "未知(无法连接网络)",
          address,
          networkError: true,
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * 验证比特币地址
   * @param {string} address - 比特币地址
   * @param {string} networkType - 网络类型 ("mainnet" 或 "testnet")
   * @returns {Promise<object>} 验证结果
   */
  static async validateBitcoinAddress(address, networkType = null) {
    try {
      // 首先验证地址格式
      if (!MultiChainWalletGenerator.validateAddress(address, "BTC")) {
        return {
          valid: false,
          error: "比特币地址格式无效",
        };
      }

      // 如果未指定网络类型，使用默认配置
      if (!networkType) {
        networkType = userNetworkConfig.bitcoin;
      }

      // 检查是否支持的网络类型
      if (!networkConfigs.bitcoin[networkType]) {
        return {
          valid: false,
          error: `不支持的比特币网络类型: ${networkType}`,
        };
      }

      const networkConfig = networkConfigs.bitcoin[networkType];

      // 确定地址类型
      let addressType = "未知";
      if (address.startsWith("bc1p")) {
        addressType = "Taproot";
      } else if (address.startsWith("bc1q") || address.startsWith("bc1")) {
        addressType = "Native SegWit";
      } else if (address.startsWith("3")) {
        addressType = "P2SH-SegWit";
      } else if (address.startsWith("1")) {
        addressType = "Legacy";
      }

      // 调用外部API验证地址(区块链浏览器API)
      try {
        // 设置超时
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`连接${networkConfig.name} API超时`)),
            5000
          );
        });

        // 发送API请求
        const requestPromise = axios.get(
          `${networkConfig.apiUrl}/address/${address}`
        );

        // 等待API响应或超时
        const response = await Promise.race([requestPromise, timeoutPromise]);

        // 如果API响应成功，说明地址有效
        return {
          valid: true,
          network: `${networkConfig.name} (${addressType})`,
          balance: response.data.chain_stats.funded_txo_sum / 100000000, // 转换为BTC单位
          address,
        };
      } catch (apiError) {
        // API调用失败，但这可能只是因为地址在链上未使用过
        // 如果地址格式正确，我们仍然认为它是有效的
        return {
          valid: true,
          network: `${networkConfig.name} (${addressType})`,
          balance: "0 (未在链上使用或无法连接网络)",
          address,
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * 验证Solana地址
   * @param {string} address - Solana地址
   * @param {string} networkType - 网络类型 ("mainnet", "testnet", "devnet")
   * @returns {Promise<object>} 验证结果
   */
  static async validateSolanaAddress(address, networkType = null) {
    try {
      // 首先验证地址格式
      new PublicKey(address);

      // 如果未指定网络类型，使用默认配置
      if (!networkType) {
        networkType = userNetworkConfig.solana;
      }

      // 检查是否支持的网络类型
      if (!networkConfigs.solana[networkType]) {
        return {
          valid: false,
          error: `不支持的Solana网络类型: ${networkType}`,
        };
      }

      const networkConfig = networkConfigs.solana[networkType];

      // 连接到Solana网络
      try {
        // 设置超时
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`连接${networkConfig.name}超时`)),
            5000
          );
        });

        // 连接到指定Solana网络
        const connection = new Connection(
          clusterApiUrl(networkConfig.cluster),
          "confirmed"
        );

        // 获取地址余额
        const balancePromise = connection.getBalance(new PublicKey(address));
        const balance = await Promise.race([balancePromise, timeoutPromise]);

        return {
          valid: true,
          network: networkConfig.name,
          balance: balance / LAMPORTS_PER_SOL,
          address,
        };
      } catch (netError) {
        // 网络连接错误，但地址格式正确
        return {
          valid: true,
          network: networkConfig.name,
          balance: "未知(无法连接网络)",
          address,
          networkError: true,
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * 验证SUI地址
   * @param {string} address - SUI地址
   * @param {string} networkType - 网络类型 ("mainnet", "testnet", "devnet")
   * @returns {Promise<object>} 验证结果
   */
  static async validateSuiAddress(address, networkType = null) {
    try {
      // 验证地址格式
      if (!MultiChainWalletGenerator.validateAddress(address, "SUI")) {
        return {
          valid: false,
          error: "SUI地址格式无效",
        };
      }

      // 如果未指定网络类型，使用默认配置
      if (!networkType) {
        networkType = userNetworkConfig.sui;
      }

      // 检查是否支持的网络类型
      if (!networkConfigs.sui[networkType]) {
        return {
          valid: false,
          error: `不支持的SUI网络类型: ${networkType}`,
        };
      }

      const networkConfig = networkConfigs.sui[networkType];

      // 使用SUI的网络API
      try {
        // 设置超时
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`连接${networkConfig.name}超时`)),
            5000
          );
        });

        // 发送API请求
        const requestPromise = axios.post(
          networkConfig.rpcUrl,
          {
            jsonrpc: "2.0",
            id: 1,
            method: "suix_getBalance",
            params: [address],
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        // 等待API响应或超时
        const response = await Promise.race([requestPromise, timeoutPromise]);

        if (response.data && response.data.result) {
          return {
            valid: true,
            network: networkConfig.name,
            balance:
              parseInt(response.data.result.totalBalance || "0") / 1000000000,
            address,
          };
        } else {
          return {
            valid: true,
            network: networkConfig.name,
            balance: "0",
            address,
          };
        }
      } catch (apiError) {
        // API调用失败，但地址格式正确，仍视为有效
        return {
          valid: true,
          network: networkConfig.name,
          balance: "未知(无法连接网络)",
          address,
          networkError: true,
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * 验证所有支持的链地址
   * @param {object} wallets - 钱包对象
   * @param {object} networkTypes - 每条链指定的网络类型
   * @returns {Promise<object>} 验证结果
   */
  static async validateAllAddresses(wallets, networkTypes = {}) {
    const results = {};

    // 验证ETH地址
    if (wallets.ETH && wallets.ETH.address) {
      console.log(chalk.blue("正在验证ETH地址..."));
      results.ETH = await this.validateEthereumAddress(
        wallets.ETH.address,
        "ethereum",
        networkTypes.ETH
      );
    }

    // 验证BNB地址
    if (wallets.BNB && wallets.BNB.address) {
      console.log(chalk.blue("正在验证BNB地址..."));
      results.BNB = await this.validateEthereumAddress(
        wallets.BNB.address,
        "bnb",
        networkTypes.BNB
      );
    }

    // 验证BTC地址
    if (wallets.BTC && wallets.BTC.address) {
      console.log(chalk.blue("正在验证BTC地址..."));
      results.BTC = await this.validateBitcoinAddress(
        wallets.BTC.address,
        networkTypes.BTC
      );
    }

    // 验证SOL地址
    if (wallets.SOL && wallets.SOL.address) {
      console.log(chalk.blue("正在验证SOL地址..."));
      results.SOL = await this.validateSolanaAddress(
        wallets.SOL.address,
        networkTypes.SOL
      );
    }

    // 验证SUI地址
    if (wallets.SUI && wallets.SUI.address) {
      console.log(chalk.blue("正在验证SUI地址..."));
      results.SUI = await this.validateSuiAddress(
        wallets.SUI.address,
        networkTypes.SUI
      );
    }

    return results;
  }

  /**
   * 验证单个地址
   * @param {string} address - 钱包地址
   * @param {string} chain - 链类型
   * @param {string} networkType - 网络类型
   * @returns {Promise<object>} 验证结果
   */
  static async validateAddress(address, chain, networkType = null) {
    switch (chain.toUpperCase()) {
      case "ETH":
        return this.validateEthereumAddress(address, "ethereum", networkType);
      case "BNB":
        return this.validateEthereumAddress(address, "bnb", networkType);
      case "BTC":
        return this.validateBitcoinAddress(address, networkType);
      case "SOL":
        return this.validateSolanaAddress(address, networkType);
      case "SUI":
        return this.validateSuiAddress(address, networkType);
      default:
        return {
          valid: false,
          error: `不支持的链类型: ${chain}`,
        };
    }
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 解析命令行参数
    const cmdParams = parseCommandLine();

    // 显示帮助
    if (cmdParams.help) {
      showHelp();
      return;
    }

    // 如果指定了显示网络配置选项，显示当前网络配置
    if (cmdParams.showConfig) {
      showNetworkConfig();
      return;
    }

    // 批量验证模式
    if (cmdParams.batch) {
      if (!cmdParams.chain) {
        console.log(
          chalk.red("错误: 批量验证需要指定链类型，使用 --chain 参数")
        );
        return;
      }

      if (!cmdParams.file) {
        console.log(
          chalk.red("错误: 批量验证需要指定地址文件，使用 --file 参数")
        );
        return;
      }

      try {
        // 读取地址文件
        const addresses = await readAddressesFromFile(cmdParams.file);

        if (addresses.length === 0) {
          console.log(chalk.yellow("警告: 文件中没有找到有效地址"));
          return;
        }

        console.log(
          chalk.blue(
            `从文件 ${cmdParams.file} 中读取了 ${addresses.length} 个地址`
          )
        );

        // 设置网络类型
        const networkType =
          cmdParams.network || userNetworkConfig[cmdParams.chain.toLowerCase()];

        // 批量验证地址
        const results = await batchValidateAddresses(
          addresses,
          cmdParams.chain,
          networkType
        );

        // 统计结果
        const validAddresses = results.filter((r) => r.valid).length;
        const invalidAddresses = results.length - validAddresses;

        console.log(
          chalk.green(
            `\n验证完成! 总计: ${results.length}, 有效: ${validAddresses}, 无效: ${invalidAddresses}`
          )
        );

        // 如果指定了输出文件，保存结果
        if (cmdParams.output) {
          saveResultsToFile(
            results,
            cmdParams.output,
            cmdParams.chain,
            networkType
          );
        }

        return;
      } catch (error) {
        console.error(chalk.red(`批量验证失败: ${error.message}`));
        return;
      }
    }

    // 如果提供了链和地址，直接验证
    if (cmdParams.chain && cmdParams.address) {
      console.log(
        chalk.blue(`正在验证${cmdParams.chain}地址: ${cmdParams.address}...\n`)
      );

      const result = await AddressValidator.validateAddress(
        cmdParams.address,
        cmdParams.chain,
        cmdParams.network
      );

      if (result.valid) {
        console.log(chalk.green(`✓ 有效 (${result.network})`));
        console.log(`地址: ${result.address} 余额: ${result.balance}`);
      } else {
        console.log(chalk.red(`✗ 无效: ${result.error}`));
      }

      return;
    }

    // 如果指定了生成选项，自动生成并验证所有链的钱包
    if (cmdParams.generate) {
      const chains = ["BTC", "ETH", "SOL", "SUI", "BNB"];
      const btcAddressType = "nativesegwit";

      // 如果指定了网络，使用指定的网络类型
      const networkTypes = {};
      if (cmdParams.network) {
        // 默认所有链都使用相同的网络类型
        chains.forEach((chain) => {
          // 检查是否是支持的网络类型
          switch (chain) {
            case "ETH":
              if (networkConfigs.ethereum[cmdParams.network]) {
                networkTypes.ETH = cmdParams.network;
              }
              break;
            case "BNB":
              if (networkConfigs.bnb[cmdParams.network]) {
                networkTypes.BNB = cmdParams.network;
              }
              break;
            case "BTC":
              if (networkConfigs.bitcoin[cmdParams.network]) {
                networkTypes.BTC = cmdParams.network;
              }
              break;
            case "SOL":
              if (networkConfigs.solana[cmdParams.network]) {
                networkTypes.SOL = cmdParams.network;
              }
              break;
            case "SUI":
              if (networkConfigs.sui[cmdParams.network]) {
                networkTypes.SUI = cmdParams.network;
              }
              break;
          }
        });
      }

      console.log(chalk.blue("\n正在生成钱包...\n"));

      // 生成钱包
      const generatedWallets =
        await MultiChainWalletGenerator.generateMultipleWallets(1, chains, {
          btcAddressType,
        });

      const wallets = generatedWallets[0]; // 取第一个钱包组

      // 显示生成的钱包信息
      console.log(chalk.green("生成的钱包信息:"));
      for (const chain in wallets) {
        console.log(chalk.cyan(`\n${chain} 钱包:`));
        console.log(`地址: ${wallets[chain].address}`);
        console.log(`私钥: ${wallets[chain].privateKey}`);
      }

      console.log(chalk.blue("\n开始验证钱包地址在测试网上的有效性...\n"));

      // 显示将使用的网络
      if (Object.keys(networkTypes).length > 0) {
        console.log(chalk.yellow("将使用以下网络进行验证:"));
        for (const chain in networkTypes) {
          const networkType = networkTypes[chain];
          let networkName;
          switch (chain) {
            case "ETH":
              networkName = networkConfigs.ethereum[networkType].name;
              break;
            case "BNB":
              networkName = networkConfigs.bnb[networkType].name;
              break;
            case "BTC":
              networkName = networkConfigs.bitcoin[networkType].name;
              break;
            case "SOL":
              networkName = networkConfigs.solana[networkType].name;
              break;
            case "SUI":
              networkName = networkConfigs.sui[networkType].name;
              break;
          }
          console.log(`${chain}: ${networkName}`);
        }
        console.log("");
      }

      // 验证钱包地址
      const results = await AddressValidator.validateAllAddresses(
        wallets,
        networkTypes
      );

      // 显示验证结果
      console.log(chalk.green("\n验证结果:"));

      for (const chain in results) {
        const result = results[chain];
        if (result.valid) {
          console.log(chalk.cyan(`\n${chain} 钱包:`));
          console.log(chalk.green(`✓ 有效 (${result.network})`));
          console.log(`地址: ${result.address} 余额: ${result.balance}`);

          if (result.networkError) {
            console.log(chalk.yellow("注意: 无法连接到网络，但地址格式有效"));
          }
        } else {
          console.log(chalk.cyan(`\n${chain} 钱包:`));
          console.log(chalk.red(`✗ 无效: ${result.error}`));
        }
      }

      return;
    }

    // 默认交互式操作
    console.log(chalk.green("===== 多链钱包地址测试网验证工具 =====\n"));

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "请选择操作:",
        choices: [
          { name: "生成新钱包并验证", value: "generate" },
          { name: "验证已有钱包地址", value: "verify" },
          { name: "批量验证地址", value: "batch" },
          { name: "显示/修改网络配置", value: "config" },
        ],
      },
    ]);

    // 处理批量验证模式
    if (action === "batch") {
      // 选择链类型
      const { chain } = await inquirer.prompt([
        {
          type: "list",
          name: "chain",
          message: "请选择链类型:",
          choices: [
            { name: "Bitcoin (BTC)", value: "BTC" },
            { name: "Ethereum (ETH)", value: "ETH" },
            { name: "Solana (SOL)", value: "SOL" },
            { name: "SUI", value: "SUI" },
            { name: "BNB Chain (BNB)", value: "BNB" },
          ],
        },
      ]);

      // 选择网络类型
      let networkPrompt;
      if (chain === "ETH") {
        networkPrompt = {
          type: "list",
          name: "network",
          message: "请选择以太坊网络:",
          choices: [
            { name: "以太坊主网", value: "mainnet" },
            { name: "Goerli测试网", value: "goerli" },
            { name: "Sepolia测试网", value: "sepolia" },
          ],
          default: userNetworkConfig.ethereum,
        };
      } else if (chain === "BNB") {
        networkPrompt = {
          type: "list",
          name: "network",
          message: "请选择BNB Chain网络:",
          choices: [
            { name: "BNB Chain主网", value: "mainnet" },
            { name: "BNB Chain测试网", value: "testnet" },
          ],
          default: userNetworkConfig.bnb,
        };
      } else if (chain === "BTC") {
        networkPrompt = {
          type: "list",
          name: "network",
          message: "请选择比特币网络:",
          choices: [
            { name: "比特币主网", value: "mainnet" },
            { name: "比特币测试网", value: "testnet" },
          ],
          default: userNetworkConfig.bitcoin,
        };
      } else if (chain === "SOL") {
        networkPrompt = {
          type: "list",
          name: "network",
          message: "请选择Solana网络:",
          choices: [
            { name: "Solana主网", value: "mainnet" },
            { name: "Solana测试网", value: "testnet" },
            { name: "Solana Devnet", value: "devnet" },
          ],
          default: userNetworkConfig.solana,
        };
      } else if (chain === "SUI") {
        networkPrompt = {
          type: "list",
          name: "network",
          message: "请选择SUI网络:",
          choices: [
            { name: "SUI主网", value: "mainnet" },
            { name: "SUI测试网", value: "testnet" },
            { name: "SUI Devnet", value: "devnet" },
          ],
          default: userNetworkConfig.sui,
        };
      }

      const { network } = await inquirer.prompt([networkPrompt]);

      // 选择输入方式
      const { inputMethod } = await inquirer.prompt([
        {
          type: "list",
          name: "inputMethod",
          message: "请选择地址输入方式:",
          choices: [
            { name: "从文件导入地址", value: "file" },
            { name: "手动输入多个地址", value: "manual" },
          ],
        },
      ]);

      let addresses = [];

      if (inputMethod === "file") {
        // 输入文件路径
        const { filePath } = await inquirer.prompt([
          {
            type: "input",
            name: "filePath",
            message: "请输入地址文件路径 (每行一个地址):",
            validate: (value) => {
              if (!value.trim()) {
                return "文件路径不能为空";
              }
              if (!fs.existsSync(value.trim())) {
                return "文件不存在，请检查路径";
              }
              return true;
            },
          },
        ]);

        // 读取地址
        addresses = await readAddressesFromFile(filePath.trim());

        if (addresses.length === 0) {
          console.log(chalk.yellow("警告: 文件中没有找到有效地址"));
          return;
        }

        console.log(chalk.blue(`从文件中读取了 ${addresses.length} 个地址`));
      } else {
        // 手动输入地址
        const { addressInput } = await inquirer.prompt([
          {
            type: "editor",
            name: "addressInput",
            message: "请输入多个地址 (每行一个地址):",
            validate: (value) => {
              if (!value.trim()) {
                return "地址不能为空";
              }
              return true;
            },
          },
        ]);

        // 解析输入的地址
        addresses = addressInput
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"));

        if (addresses.length === 0) {
          console.log(chalk.yellow("警告: 没有找到有效地址"));
          return;
        }

        console.log(chalk.blue(`读取了 ${addresses.length} 个地址`));
      }

      // 是否保存结果到文件
      const { saveToFile } = await inquirer.prompt([
        {
          type: "confirm",
          name: "saveToFile",
          message: "是否保存验证结果到文件?",
          default: true,
        },
      ]);

      let outputPath = "";
      if (saveToFile) {
        // 输入输出文件路径
        const { filePath } = await inquirer.prompt([
          {
            type: "input",
            name: "filePath",
            message: "请输入结果保存路径:",
            default: `${chain.toLowerCase()}_validation_results.txt`,
            validate: (value) => {
              if (!value.trim()) {
                return "文件路径不能为空";
              }
              return true;
            },
          },
        ]);

        outputPath = filePath.trim();
      }

      // 批量验证地址
      const results = await batchValidateAddresses(addresses, chain, network);

      // 统计结果
      const validAddresses = results.filter((r) => r.valid).length;
      const invalidAddresses = results.length - validAddresses;

      console.log(
        chalk.green(
          `\n验证完成! 总计: ${results.length}, 有效: ${validAddresses}, 无效: ${invalidAddresses}`
        )
      );

      // 如果需要保存结果到文件
      if (saveToFile && outputPath) {
        saveResultsToFile(results, outputPath, chain, network);
      }

      return;
    }

    // 处理配置选项
    if (action === "config") {
      // 显示当前配置
      showNetworkConfig();

      // 询问是否修改配置
      const { changeConfig } = await inquirer.prompt([
        {
          type: "confirm",
          name: "changeConfig",
          message: "是否修改默认网络配置?",
          default: false,
        },
      ]);

      if (changeConfig) {
        // 修改以太坊网络
        const { ethNetwork } = await inquirer.prompt([
          {
            type: "list",
            name: "ethNetwork",
            message: "选择以太坊默认网络:",
            choices: [
              { name: "以太坊主网", value: "mainnet" },
              { name: "Goerli测试网", value: "goerli" },
              { name: "Sepolia测试网", value: "sepolia" },
            ],
            default: userNetworkConfig.ethereum,
          },
        ]);
        userNetworkConfig.ethereum = ethNetwork;

        // 修改BNB网络
        const { bnbNetwork } = await inquirer.prompt([
          {
            type: "list",
            name: "bnbNetwork",
            message: "选择BNB Chain默认网络:",
            choices: [
              { name: "BNB Chain主网", value: "mainnet" },
              { name: "BNB Chain测试网", value: "testnet" },
            ],
            default: userNetworkConfig.bnb,
          },
        ]);
        userNetworkConfig.bnb = bnbNetwork;

        // 修改比特币网络
        const { btcNetwork } = await inquirer.prompt([
          {
            type: "list",
            name: "btcNetwork",
            message: "选择比特币默认网络:",
            choices: [
              { name: "比特币主网", value: "mainnet" },
              { name: "比特币测试网", value: "testnet" },
            ],
            default: userNetworkConfig.bitcoin,
          },
        ]);
        userNetworkConfig.bitcoin = btcNetwork;

        // 修改Solana网络
        const { solNetwork } = await inquirer.prompt([
          {
            type: "list",
            name: "solNetwork",
            message: "选择Solana默认网络:",
            choices: [
              { name: "Solana主网", value: "mainnet" },
              { name: "Solana测试网", value: "testnet" },
              { name: "Solana Devnet", value: "devnet" },
            ],
            default: userNetworkConfig.solana,
          },
        ]);
        userNetworkConfig.solana = solNetwork;

        // 修改SUI网络
        const { suiNetwork } = await inquirer.prompt([
          {
            type: "list",
            name: "suiNetwork",
            message: "选择SUI默认网络:",
            choices: [
              { name: "SUI主网", value: "mainnet" },
              { name: "SUI测试网", value: "testnet" },
              { name: "SUI Devnet", value: "devnet" },
            ],
            default: userNetworkConfig.sui,
          },
        ]);
        userNetworkConfig.sui = suiNetwork;

        console.log(chalk.green("\n网络配置已更新!"));
        showNetworkConfig();
      }

      return;
    }

    let wallets = {};
    const networkTypes = {}; // 存储用户选择的网络类型

    if (action === "generate") {
      // 获取用户选择的链
      const { chains } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "chains",
          message: "请选择要生成的链类型:",
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

      // 为每条链选择网络
      for (const chain of chains) {
        if (chain === "ETH") {
          const { network } = await inquirer.prompt([
            {
              type: "list",
              name: "network",
              message: "请选择以太坊网络:",
              choices: [
                { name: "以太坊主网", value: "mainnet" },
                { name: "Goerli测试网", value: "goerli" },
                { name: "Sepolia测试网", value: "sepolia" },
              ],
              default: userNetworkConfig.ethereum,
            },
          ]);
          networkTypes.ETH = network;
        } else if (chain === "BNB") {
          const { network } = await inquirer.prompt([
            {
              type: "list",
              name: "network",
              message: "请选择BNB Chain网络:",
              choices: [
                { name: "BNB Chain主网", value: "mainnet" },
                { name: "BNB Chain测试网", value: "testnet" },
              ],
              default: userNetworkConfig.bnb,
            },
          ]);
          networkTypes.BNB = network;
        } else if (chain === "SOL") {
          const { network } = await inquirer.prompt([
            {
              type: "list",
              name: "network",
              message: "请选择Solana网络:",
              choices: [
                { name: "Solana主网", value: "mainnet" },
                { name: "Solana测试网", value: "testnet" },
                { name: "Solana Devnet", value: "devnet" },
              ],
              default: userNetworkConfig.solana,
            },
          ]);
          networkTypes.SOL = network;
        } else if (chain === "SUI") {
          const { network } = await inquirer.prompt([
            {
              type: "list",
              name: "network",
              message: "请选择SUI网络:",
              choices: [
                { name: "SUI主网", value: "mainnet" },
                { name: "SUI测试网", value: "testnet" },
                { name: "SUI Devnet", value: "devnet" },
              ],
              default: userNetworkConfig.sui,
            },
          ]);
          networkTypes.SUI = network;
        }
      }

      // 如果选择了BTC，询问地址类型
      let btcAddressType = "nativesegwit"; // 默认
      if (chains.includes("BTC")) {
        const { btcType } = await inquirer.prompt([
          {
            type: "list",
            name: "btcType",
            message: "请选择比特币地址类型:",
            choices: [
              { name: "Taproot (bc1p开头)", value: "taproot" },
              { name: "Native SegWit (bc1q开头)", value: "nativesegwit" },
            ],
          },
        ]);
        btcAddressType = btcType;

        // 选择比特币网络
        const { network } = await inquirer.prompt([
          {
            type: "list",
            name: "network",
            message: "请选择比特币网络:",
            choices: [
              { name: "比特币主网", value: "mainnet" },
              { name: "比特币测试网", value: "testnet" },
            ],
            default: userNetworkConfig.bitcoin,
          },
        ]);
        networkTypes.BTC = network;
      }

      console.log(chalk.blue("\n正在生成钱包...\n"));

      // 生成钱包
      const generatedWallets =
        await MultiChainWalletGenerator.generateMultipleWallets(1, chains, {
          btcAddressType,
        });

      wallets = generatedWallets[0]; // 取第一个钱包组

      // 显示生成的钱包信息
      console.log(chalk.green("生成的钱包信息:"));
      for (const chain in wallets) {
        console.log(chalk.cyan(`\n${chain} 钱包:`));
        console.log(`地址: ${wallets[chain].address}`);
        console.log(`私钥: ${wallets[chain].privateKey}`);
      }
    } else {
      // 用户选择验证已有钱包
      const { chains } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "chains",
          message: "请选择要验证的链类型:",
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

      // 为每条链选择网络并输入地址
      for (const chain of chains) {
        let networkPrompt;

        if (chain === "ETH") {
          networkPrompt = {
            type: "list",
            name: "network",
            message: "请选择以太坊网络:",
            choices: [
              { name: "以太坊主网", value: "mainnet" },
              { name: "Goerli测试网", value: "goerli" },
              { name: "Sepolia测试网", value: "sepolia" },
            ],
            default: userNetworkConfig.ethereum,
          };
        } else if (chain === "BNB") {
          networkPrompt = {
            type: "list",
            name: "network",
            message: "请选择BNB Chain网络:",
            choices: [
              { name: "BNB Chain主网", value: "mainnet" },
              { name: "BNB Chain测试网", value: "testnet" },
            ],
            default: userNetworkConfig.bnb,
          };
        } else if (chain === "BTC") {
          networkPrompt = {
            type: "list",
            name: "network",
            message: "请选择比特币网络:",
            choices: [
              { name: "比特币主网", value: "mainnet" },
              { name: "比特币测试网", value: "testnet" },
            ],
            default: userNetworkConfig.bitcoin,
          };
        } else if (chain === "SOL") {
          networkPrompt = {
            type: "list",
            name: "network",
            message: "请选择Solana网络:",
            choices: [
              { name: "Solana主网", value: "mainnet" },
              { name: "Solana测试网", value: "testnet" },
              { name: "Solana Devnet", value: "devnet" },
            ],
            default: userNetworkConfig.solana,
          };
        } else if (chain === "SUI") {
          networkPrompt = {
            type: "list",
            name: "network",
            message: "请选择SUI网络:",
            choices: [
              { name: "SUI主网", value: "mainnet" },
              { name: "SUI测试网", value: "testnet" },
              { name: "SUI Devnet", value: "devnet" },
            ],
            default: userNetworkConfig.sui,
          };
        }

        // 选择网络
        const { network } = await inquirer.prompt([networkPrompt]);
        networkTypes[chain] = network;

        // 输入地址
        const { address } = await inquirer.prompt([
          {
            type: "input",
            name: "address",
            message: `请输入${chain}钱包地址:`,
            validate: (value) => {
              if (!value.trim()) {
                return "地址不能为空";
              }
              return true;
            },
          },
        ]);

        wallets[chain] = { address: address.trim() };
      }
    }

    console.log(chalk.blue("\n开始验证钱包地址在指定网络上的有效性...\n"));

    // 显示将使用的网络
    if (Object.keys(networkTypes).length > 0) {
      console.log(chalk.yellow("将使用以下网络进行验证:"));
      for (const chain in networkTypes) {
        const networkType = networkTypes[chain];
        let networkName;
        switch (chain) {
          case "ETH":
            networkName = networkConfigs.ethereum[networkType].name;
            break;
          case "BNB":
            networkName = networkConfigs.bnb[networkType].name;
            break;
          case "BTC":
            networkName = networkConfigs.bitcoin[networkType].name;
            break;
          case "SOL":
            networkName = networkConfigs.solana[networkType].name;
            break;
          case "SUI":
            networkName = networkConfigs.sui[networkType].name;
            break;
        }
        console.log(`${chain}: ${networkName}`);
      }
      console.log("");
    }

    // 验证钱包地址
    const results = await AddressValidator.validateAllAddresses(
      wallets,
      networkTypes
    );

    // 显示验证结果
    console.log(chalk.green("\n验证结果:"));

    for (const chain in results) {
      const result = results[chain];
      if (result.valid) {
        console.log(chalk.cyan(`\n${chain} 钱包:`));
        console.log(chalk.green(`✓ 有效 (${result.network})`));
        console.log(`地址: ${result.address} 余额: ${result.balance}`);

        if (result.networkError) {
          console.log(chalk.yellow("注意: 无法连接到网络，但地址格式有效"));
        }
      } else {
        console.log(chalk.cyan(`\n${chain} 钱包:`));
        console.log(chalk.red(`✗ 无效: ${result.error}`));
      }
    }

    console.log(chalk.green("\n验证完成!"));
  } catch (error) {
    console.error(chalk.red("\n错误:"), error.message);
  }
}

// 如果直接运行此文件，则执行main函数
if (require.main === module) {
  main();
}

module.exports = {
  AddressValidator,
};
