const { AddressValidator } = require("./test-addresses.js");
const chalk = require("chalk");
const fs = require("fs");
const readline = require("readline");
const path = require("path");

/**
 * 从文件中读取多链地址列表
 * @param {string} filePath - 文件路径
 * @returns {Promise<Object>} 按链类型分组的地址对象
 */
async function readMultiChainAddressesFromFile(filePath) {
  try {
    // 确保文件存在
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const addressesByChain = {};

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
        // 解析[链代码]=地址格式
        const parts = trimmedLine.split("=");

        if (parts.length === 2) {
          const chain = parts[0].trim().toUpperCase();
          const address = parts[1].trim();

          if (!addressesByChain[chain]) {
            addressesByChain[chain] = [];
          }

          addressesByChain[chain].push(address);
        }
      }
    }

    return addressesByChain;
  } catch (error) {
    throw new Error(`读取地址文件失败: ${error.message}`);
  }
}

/**
 * 保存多链验证结果到文件
 * @param {Object} resultsByChain - 按链分组的验证结果
 * @param {string} filePath - 输出文件路径
 * @param {Object} networkTypes - 每条链使用的网络类型
 */
function saveMultiChainResultsToFile(resultsByChain, filePath, networkTypes) {
  try {
    // 准备输出内容
    let output = `===== 多链钱包地址批量验证结果 =====\n\n`;
    output += `验证时间: ${new Date().toLocaleString()}\n\n`;

    // 计算总体统计
    let totalAddresses = 0;
    let totalValid = 0;
    let totalInvalid = 0;

    // 对每条链的结果进行处理
    for (const chain in resultsByChain) {
      const results = resultsByChain[chain];
      const validAddresses = results.filter((r) => r.valid).length;
      const invalidAddresses = results.length - validAddresses;

      totalAddresses += results.length;
      totalValid += validAddresses;
      totalInvalid += invalidAddresses;

      output += `=== ${chain} 验证结果 ===\n`;
      output += `网络: ${networkTypes[chain] || "默认"}\n`;
      output += `总地址数: ${results.length}\n`;
      output += `有效地址: ${validAddresses}\n`;
      output += `无效地址: ${invalidAddresses}\n\n`;

      // 添加详细结果
      if (validAddresses > 0) {
        output += `--- 有效地址 ---\n\n`;
        results
          .filter((r) => r.valid)
          .forEach((result, index) => {
            output += `${index + 1}. ${result.address} 余额: ${result.balance}\n`;
            if (result.networkError) {
              output += `   注意: 无法连接到网络，但地址格式有效\n`;
            }
            output += `\n`;
          });
      }

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

      output += `\n`;
    }

    // 添加总体统计
    output += `===== 总体统计 =====\n\n`;
    output += `总验证地址: ${totalAddresses}\n`;
    output += `总有效地址: ${totalValid}\n`;
    output += `总无效地址: ${totalInvalid}\n`;

    // 写入文件
    fs.writeFileSync(filePath, output);

    console.log(chalk.green(`\n验证结果已保存到文件: ${filePath}`));
  } catch (error) {
    console.error(chalk.red(`保存结果到文件失败: ${error.message}`));
  }
}

/**
 * 批量验证多链地址
 * @param {Object} addressesByChain - 按链分组的地址列表
 * @param {Object} networkTypes - 每条链使用的网络类型
 * @returns {Promise<Object>} 验证结果
 */
async function batchValidateMultiChainAddresses(
  addressesByChain,
  networkTypes = {}
) {
  console.log(chalk.blue(`开始多链批量验证...\n`));

  const resultsByChain = {};

  // 对每条链的地址进行验证
  for (const chain in addressesByChain) {
    const addresses = addressesByChain[chain];
    const networkType = networkTypes[chain];

    console.log(
      chalk.blue(`\n验证 ${chain} 地址 (共${addresses.length}个)...\n`)
    );

    resultsByChain[chain] = [];

    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      console.log(
        chalk.blue(
          `[${i + 1}/${addresses.length}] 正在验证${chain}地址: ${address}`
        )
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

        resultsByChain[chain].push(result);
      } catch (error) {
        console.log(chalk.red(`✗ 验证失败: ${error.message}`));
        resultsByChain[chain].push({
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

    // 统计结果
    const validAddresses = resultsByChain[chain].filter((r) => r.valid).length;
    const invalidAddresses = addresses.length - validAddresses;

    console.log(
      chalk.green(
        `\n${chain} 验证完成: 总计: ${addresses.length}, 有效: ${validAddresses}, 无效: ${invalidAddresses}`
      )
    );
  }

  return resultsByChain;
}

/**
 * 解析命令行参数
 * @returns {Object} 命令行参数
 */
function parseCommandLine() {
  const args = process.argv.slice(2);
  const params = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--file" && i + 1 < args.length) {
      params.file = args[i + 1];
      i++;
    } else if (args[i] === "--output" && i + 1 < args.length) {
      params.output = args[i + 1];
      i++;
    } else if (args[i] === "--network" && i + 1 < args.length) {
      // 解析网络参数，格式: ETH=mainnet,BTC=testnet,...
      const networkString = args[i + 1];
      params.networks = {};

      networkString.split(",").forEach((part) => {
        const [chain, network] = part.split("=");
        if (chain && network) {
          params.networks[chain.toUpperCase()] = network.toLowerCase();
        }
      });

      i++;
    } else if (args[i] === "--help") {
      params.help = true;
    }
  }

  return params;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(chalk.green("===== 多链批量地址验证工具 =====\n"));
  console.log("用法:");
  console.log("  node test-multi-chain.js --file <文件路径> [选项]\n");
  console.log("选项:");
  console.log("  --file <文件路径>        指定包含多链地址的文件路径");
  console.log(
    "  --output <文件路径>      指定输出结果的文件路径 (默认: multi-chain-results.txt)"
  );
  console.log(
    "  --network <网络参数>     指定每条链使用的网络类型，格式: ETH=mainnet,BTC=testnet,..."
  );
  console.log("  --help                  显示帮助信息\n");
  console.log("示例:");
  console.log("  node test-multi-chain.js --file ver-address.txt");
  console.log(
    "  node test-multi-chain.js --file ver-address.txt --output results.txt --network ETH=mainnet,SOL=devnet\n"
  );
  console.log("文件格式:");
  console.log("  每行一个地址，格式为: [链代码]=地址");
  console.log("  例如: ETH=0x742d35Cc6634C0532925a3b844Bc454e4438f44e");
  console.log("  支持的链代码: BTC, ETH, SOL, SUI, BNB");
  console.log("  以 # 开头的行视为注释\n");
}

/**
 * 主函数
 */
async function main() {
  try {
    // 解析命令行参数
    const params = parseCommandLine();

    // 显示帮助
    if (params.help) {
      showHelp();
      return;
    }

    // 检查文件参数
    if (!params.file) {
      console.log(chalk.red("错误: 未指定地址文件，请使用 --file 参数"));
      showHelp();
      return;
    }

    // 设置输出文件
    const outputFile = params.output || "multi-chain-results.txt";

    // 读取地址文件
    const addressesByChain = await readMultiChainAddressesFromFile(params.file);

    // 检查是否有地址
    const chainCount = Object.keys(addressesByChain).length;
    if (chainCount === 0) {
      console.log(chalk.yellow("警告: 文件中没有找到有效地址"));
      return;
    }

    // 统计各条链的地址数量
    let totalAddresses = 0;
    for (const chain in addressesByChain) {
      totalAddresses += addressesByChain[chain].length;
    }

    console.log(
      chalk.blue(
        `从文件 ${params.file} 中读取了 ${totalAddresses} 个地址，分布在 ${chainCount} 条链上`
      )
    );
    for (const chain in addressesByChain) {
      console.log(
        chalk.blue(`- ${chain}: ${addressesByChain[chain].length} 个地址`)
      );
    }

    // 批量验证地址
    const resultsByChain = await batchValidateMultiChainAddresses(
      addressesByChain,
      params.networks || {}
    );

    // 计算总体统计
    let totalValidated = 0;
    let totalValid = 0;
    for (const chain in resultsByChain) {
      const results = resultsByChain[chain];
      totalValidated += results.length;
      totalValid += results.filter((r) => r.valid).length;
    }

    console.log(
      chalk.green(
        `\n全部验证完成! 总计: ${totalValidated} 个地址, 有效: ${totalValid}, 无效: ${
          totalValidated - totalValid
        }`
      )
    );

    // 保存结果到文件
    saveMultiChainResultsToFile(
      resultsByChain,
      outputFile,
      params.networks || {}
    );
  } catch (error) {
    console.error(chalk.red(`错误: ${error.message}`));
  }
}

// 如果直接运行此文件，则执行main函数
if (require.main === module) {
  main();
}

module.exports = {
  readMultiChainAddressesFromFile,
  batchValidateMultiChainAddresses,
  saveMultiChainResultsToFile,
};
