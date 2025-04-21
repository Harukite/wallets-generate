const { AddressValidator } = require("./test-addresses.js");
const fs = require("fs");
const readline = require("readline");
const chalk = require("chalk");
const path = require("path");

/**
 * 从wallets.txt文件中解析钱包地址
 * 文件格式示例:
 * =============== BTC Addresses ===============
 * <btc_address>
 * =============== ETH Addresses ===============
 * <eth_address>
 *
 * @param {string} filePath - 钱包文件路径
 * @returns {Promise<Object>} 按链类型分组的地址对象
 */
async function parseWalletsFile(filePath) {
  try {
    // 确保文件存在
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const addressesByChain = {};
    let currentChain = null;

    // 创建文件读取流
    const fileStream = fs.createReadStream(filePath);

    // 创建readline接口
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // 正则表达式用于识别各区块链标题行
    const btcRegex = /===============\s*BTC\s*Addresses\s*===============/i;
    const ethRegex = /===============\s*ETH\s*Addresses\s*===============/i;
    const solRegex = /===============\s*SOL\s*Addresses\s*===============/i;
    const suiRegex = /===============\s*SUI\s*Addresses\s*===============/i;
    const bnbRegex = /===============\s*BNB\s*Addresses\s*===============/i;

    // 逐行读取地址
    for await (const line of rl) {
      const trimmedLine = line.trim();

      // 跳过空行
      if (!trimmedLine) continue;

      // 检查当前行是否为区块链标题行
      if (btcRegex.test(trimmedLine)) {
        currentChain = "BTC";
        continue;
      } else if (ethRegex.test(trimmedLine)) {
        currentChain = "ETH";
        continue;
      } else if (solRegex.test(trimmedLine)) {
        currentChain = "SOL";
        continue;
      } else if (suiRegex.test(trimmedLine)) {
        currentChain = "SUI";
        continue;
      } else if (bnbRegex.test(trimmedLine)) {
        currentChain = "BNB";
        continue;
      }

      // 如果当前有识别到的区块链类型，且行不为空，将地址添加到对应类型
      if (currentChain && trimmedLine) {
        if (!addressesByChain[currentChain]) {
          addressesByChain[currentChain] = [];
        }

        addressesByChain[currentChain].push(trimmedLine);
      }
    }

    return addressesByChain;
  } catch (error) {
    throw new Error(`解析钱包文件失败: ${error.message}`);
  }
}

/**
 * 验证钱包地址并保存结果
 * @param {Object} addressesByChain - 按链分组的地址对象
 * @param {Object} networkTypes - 网络类型配置
 * @param {string} outputFile - 输出文件路径
 * @returns {Promise<void>}
 */
async function validateWallets(
  addressesByChain,
  networkTypes = {},
  outputFile = "wallet-validation-results.txt"
) {
  try {
    console.log(chalk.blue("开始验证钱包地址...\n"));

    const validationResults = {};
    let totalAddresses = 0;
    let totalValid = 0;

    // 对每条链的地址进行验证
    for (const chain in addressesByChain) {
      const addresses = addressesByChain[chain];
      const networkType = networkTypes[chain] || "mainnet";

      console.log(
        chalk.blue(`\n验证 ${chain} 地址 (共${addresses.length}个)...\n`)
      );

      validationResults[chain] = [];

      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        console.log(
          chalk.blue(
            `[${i + 1}/${addresses.length}] 正在验证${chain}地址: ${address}`
          )
        );

        try {
          // 调用地址验证器
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

          validationResults[chain].push(result);

          if (result.valid) totalValid++;
        } catch (error) {
          console.log(chalk.red(`✗ 验证失败: ${error.message}`));
          validationResults[chain].push({
            valid: false,
            address,
            error: error.message,
          });
        }

        totalAddresses++;

        // 添加间隔，避免API限制
        if (i < addresses.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      // 显示每条链的验证结果
      const validCount = validationResults[chain].filter((r) => r.valid).length;
      const invalidCount = addresses.length - validCount;

      console.log(
        chalk.green(
          `\n${chain} 验证完成: 总计: ${addresses.length}, 有效: ${validCount}, 无效: ${invalidCount}`
        )
      );
    }

    // 保存验证结果到文件
    await saveValidationResults(validationResults, outputFile, networkTypes);

    console.log(
      chalk.green(
        `\n全部验证完成! 总计: ${totalAddresses} 个地址, 有效: ${totalValid}, 无效: ${
          totalAddresses - totalValid
        }`
      )
    );
    console.log(chalk.green(`验证结果已保存到文件: ${outputFile}`));
  } catch (error) {
    console.error(chalk.red(`验证钱包时出错: ${error.message}`));
  }
}

/**
 * 保存验证结果到文件
 * @param {Object} results - 验证结果
 * @param {string} filePath - 输出文件路径
 * @param {Object} networkTypes - 网络类型配置
 * @returns {Promise<void>}
 */
async function saveValidationResults(results, filePath, networkTypes) {
  try {
    let output = `===== 钱包地址验证结果 =====\n\n`;
    output += `验证时间: ${new Date().toLocaleString()}\n\n`;

    let totalAddresses = 0;
    let totalValid = 0;

    // 处理每条链的结果
    for (const chain in results) {
      const chainResults = results[chain];
      const validAddresses = chainResults.filter((r) => r.valid).length;
      const invalidAddresses = chainResults.length - validAddresses;

      totalAddresses += chainResults.length;
      totalValid += validAddresses;

      output += `=== ${chain} 验证结果 ===\n`;
      output += `网络: ${networkTypes[chain] || "mainnet"}\n`;
      output += `总地址数: ${chainResults.length}\n`;
      output += `有效地址: ${validAddresses}\n`;
      output += `无效地址: ${invalidAddresses}\n\n`;

      // 添加有效地址详情
      if (validAddresses > 0) {
        output += `--- 有效地址 ---\n\n`;
        chainResults
          .filter((r) => r.valid)
          .forEach((result, index) => {
            output += `${index + 1}. ${result.address} 余额: ${result.balance}\n`;
            if (result.networkError) {
              output += `   注意: 无法连接到网络，但地址格式有效\n`;
            }
            output += `\n`;
          });
      }

      // 添加无效地址详情
      if (invalidAddresses > 0) {
        output += `--- 无效地址 ---\n\n`;
        chainResults
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
    output += `总无效地址: ${totalAddresses - totalValid}\n`;

    // 写入文件
    fs.writeFileSync(filePath, output);
  } catch (error) {
    throw new Error(`保存验证结果到文件失败: ${error.message}`);
  }
}

/**
 * 解析命令行参数
 * @returns {Object} 命令行参数
 */
function parseCommandLine() {
  const args = process.argv.slice(2);
  const params = {
    networks: {},
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--wallet-file" && i + 1 < args.length) {
      params.walletFile = args[i + 1];
      i++;
    } else if (args[i] === "--output" && i + 1 < args.length) {
      params.output = args[i + 1];
      i++;
    } else if (args[i] === "--network" && i + 1 < args.length) {
      // 解析网络参数，格式: ETH=mainnet,BTC=testnet,...
      const networkString = args[i + 1];

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
  console.log(chalk.green("===== 钱包地址验证工具 =====\n"));
  console.log("用法:");
  console.log("  node validate-wallets.js [选项]\n");
  console.log("选项:");
  console.log(
    "  --wallet-file <文件路径>  指定钱包文件路径 (默认: wallets/wallets.txt)"
  );
  console.log(
    "  --output <文件路径>       指定输出文件路径 (默认: wallet-validation-results.txt)"
  );
  console.log(
    "  --network <网络参数>      指定每条链使用的网络类型，格式: ETH=mainnet,BTC=testnet,..."
  );
  console.log("  --help                    显示帮助信息\n");
  console.log("示例:");
  console.log("  node validate-wallets.js");
  console.log(
    "  node validate-wallets.js --wallet-file custom-wallets.txt --output results.txt"
  );
  console.log("  node validate-wallets.js --network ETH=mainnet,SOL=devnet\n");
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

    // 设置默认参数
    const walletFile = params.walletFile || "wallets/wallets.txt";
    const outputFile = params.output || "wallet-validation-results.txt";

    console.log(chalk.blue(`使用钱包文件: ${walletFile}`));
    console.log(chalk.blue(`结果将保存到: ${outputFile}\n`));

    // 解析钱包文件
    const addressesByChain = await parseWalletsFile(walletFile);

    // 检查是否有钱包地址
    const chainCount = Object.keys(addressesByChain).length;
    if (chainCount === 0) {
      console.log(chalk.yellow("警告: 未在钱包文件中找到有效地址"));
      return;
    }

    // 显示找到的地址信息
    let totalAddresses = 0;
    for (const chain in addressesByChain) {
      totalAddresses += addressesByChain[chain].length;
    }

    console.log(
      chalk.blue(
        `从文件中解析出 ${totalAddresses} 个地址，分布在 ${chainCount} 条链上:`
      )
    );
    for (const chain in addressesByChain) {
      console.log(
        chalk.blue(`- ${chain}: ${addressesByChain[chain].length} 个地址`)
      );
    }

    // 验证钱包地址
    await validateWallets(addressesByChain, params.networks, outputFile);
  } catch (error) {
    console.error(chalk.red(`错误: ${error.message}`));
  }
}

// 如果直接运行此文件，则执行main函数
if (require.main === module) {
  main();
}

module.exports = {
  parseWalletsFile,
  validateWallets,
  saveValidationResults,
};
