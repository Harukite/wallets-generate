# 多链钱包生成器

一个支持多种区块链的钱包生成工具，可以通过命令行交互方式批量生成钱包地址和私钥。

## 功能特点

- 支持多种主流区块链：
  - 比特币 (BTC)
  - 以太坊 (ETH)
  - 索拉纳 (SOL)
  - SUI
  - TON
  - BNB Chain (BNB)
- 支持批量生成钱包
- 交互式命令行界面，简单易用
- 分类保存钱包信息到不同文件
- 支持钱包地址格式验证
- 支持助记词导入（部分链）
- 支持SUI私钥导入
- 友好的错误处理与日志输出
- 支持多链钱包地址验证
- 支持批量验证钱包地址
- 支持不同网络环境验证（主网/测试网）
- 支持验证结果保存到文件

## 安装

1. 克隆项目：
```bash
git clone https://github.com/Harukite/wallets-generate.git
cd wallets-generate
```

2. 安装依赖：
```bash
npm install
```

## 使用方法

### 命令行使用

有多种方式运行程序：

```bash

# 使用启动脚本（设置环境变量禁用警告）
node start.js

# 推荐方式
npm run start     
```

按照交互提示操作：
1. 使用空格键选择要生成的链类型
2. 使用上下箭头键导航
3. 输入要生成的钱包数量

示例界面：
```
? 请选择要生成的链类型（空格键选择，回车确认）:
 ◯ Bitcoin (BTC)
 ◯ Ethereum (ETH)
❯◯ Solana (SOL)
 ◯ SUI
 ◯ BNB Chain (BNB)

? 请输入要生成的钱包数量: _
```

### 生成的钱包信息

程序会将生成的钱包信息分别保存到三个不同的文件中：

1. wallets.txt - 保存钱包地址：
```
=============== BTC Addresses ===============

bc1q...
bc1q...

=============== ETH Addresses ===============

0x...
0x...
```

2. private_keys.txt - 保存私钥：
```
=============== BTC Private Keys ===============

5KX...
5KX...

=============== ETH Private Keys ===============

0x...
0x...
```

3. mnemonic.txt - 保存助记词（如果有）：
```
=============== BTC Mnemonics ===============

word1 word2 word3...
word1 word2 word3...

=============== ETH Mnemonics ===============

word1 word2 word3...
word1 word2 word3...
```

特点：
- 每个文件按链类型分类
- 每行一个信息，方便复制使用
- 私钥单独保存，便于安全管理
- 助记词单独保存，仅在有助记词时生成文件

### 作为模块使用

```javascript
const { MultiChainWalletGenerator } = require('./index.js');

// 生成单个ETH钱包
const ethWallet = MultiChainWalletGenerator.generateEthereumWallet();

// 生成单个BTC钱包（支持助记词导入）
const btcWallet = MultiChainWalletGenerator.generateBitcoinWallet(mnemonic);

// 批量生成多链钱包
const wallets = await MultiChainWalletGenerator.generateMultipleWallets(
  2,  // 生成数量
  ['BTC', 'ETH', 'SOL', 'BNB']  // 指定链类型
);

// 验证钱包地址
const isValid = MultiChainWalletGenerator.validateAddress(address, 'ETH');

// 从助记词导入多链钱包
const importedWallets = await MultiChainWalletGenerator.importWalletFromMnemonic(
  'your mnemonic words here',
  ['BTC', 'ETH', 'BNB']
);

// 从私钥导入SUI钱包
const suiWallet = MultiChainWalletGenerator.importSuiWallet(privateKeyInSuiprivkeyFormat);
```

### 钱包地址验证

项目提供了多种钱包地址验证工具：

1. 单链地址验证：
```bash

npm run verify

```

验证功能支持：
- 验证地址格式有效性
- 验证地址在指定网络上的余额
- 支持主网和测试网验证
- 支持批量验证结果统计
- 验证结果可保存到文件
- 支持自定义网络配置

### 网络配置

验证工具支持多种网络环境：

- ETH: mainnet, goerli, sepolia
- BNB: mainnet, testnet
- BTC: mainnet, testnet
- SOL: mainnet, testnet, devnet
- SUI: mainnet, testnet, devnet

可以通过 `--network` 参数指定网络类型：
```bash
node test/test-addresses.js --chain ETH --address 0x... --network mainnet
```

### 验证结果输出

验证结果会显示：
- 地址有效性
- 网络类型
- 地址余额
- 错误信息（如果有）

示例输出：
```
✓ 有效 (mainnet)
地址: 0x123... 余额: 0.1
```

## 常见问题

## 注意事项

1. 安全提示：
   - 生成的私钥和助记词请妥善保管，不要泄露
   - 建议在离线环境下使用本工具
   - 首次使用建议生成测试钱包验证可用性
   - 私钥文件请安全存储，建议加密保存

2. 使用说明：
   - 不同链的地址格式和私钥格式可能不同
   - TON 钱包生成需要网络连接
   - 批量生成时建议适量，避免数量过大
   - 确保安装了所有必要的依赖包

3. 技术说明：
   - ETH 和 BNB 钱包使用相同的生成逻辑，地址也相同
   - SOL、SUI 和 TON 目前不支持从助记词导入
   - BTC、ETH 和 BNB 支持助记词导入
   - SUI 私钥使用 suiprivkey 格式，可直接导入到 SUI 钱包

## 依赖说明

- ethers: 以太坊开发工具包
- @solana/web3.js: Solana 开发工具包
- @mysten/sui: SUI 开发工具包
- bitcoinjs-lib: 比特币开发工具包
- ecpair: 比特币密钥对处理
- bip39: 助记词生成和处理
- tonweb: TON 开发工具包
- hdkey: HD 钱包工具
- inquirer: 命令行交互界面
- chalk: 终端彩色输出

## License

MIT 
