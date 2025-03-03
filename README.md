# 多链钱包生成器

### 建议在安全的本地环境生成
一个支持多种区块链的钱包生成工具，可以通过命令行交互方式批量生成钱包地址和私钥。


## 功能特点

- 支持多种主流区块链：
  - 比特币 (BTC)
  - 以太坊 (ETH)
  - 索拉纳 (SOL)
  - SUI
  - TON
- 支持批量生成钱包
- 交互式命令行界面
- 自动保存钱包信息到文件
- 支持钱包地址格式验证
- 支持助记词导入（部分链）

## 安装

1. 克隆项目：
```bash
git clone <repository-url>
cd multi-chain-wallet-generator
```

2. 安装依赖：
```bash
npm install
```

## 使用方法

### 命令行使用

运行程序：
```bash
node index.js
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
 ◯ TON

? 请输入要生成的钱包数量: _
```

### 生成的钱包信息

程序会自动将生成的钱包信息保存到 `wallets.txt` 文件中，格式如下：

```
=============== BTC Wallets ===============

Wallet #1:
Address: bc1q...
Private Key: 5KX...
Public Key: 02a...
Mnemonic: word1 word2...

=============== ETH Wallets ===============

Wallet #1:
Address: 0x...
Private Key: 0x...
Public Key: 0x...
Mnemonic: word1 word2...
```

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
  ['BTC', 'ETH', 'SOL']  // 指定链类型
);

// 验证钱包地址
const isValid = MultiChainWalletGenerator.validateAddress(address, 'ETH');
```

## API 文档

### MultiChainWalletGenerator 类

#### 静态方法

##### 生成助记词
```javascript
static generateMnemonic(strength = 256)
```
- 参数：
  - strength: 助记词强度（128-256）
- 返回：助记词字符串

##### 生成单链钱包
```javascript
static generateEthereumWallet(mnemonic = null)
static generateBitcoinWallet(mnemonic = null, network = 'mainnet')
static generateSolanaWallet()
static generateSuiWallet()
static async generateTonWallet()
```
- 参数：
  - mnemonic: 可选助记词（仅 BTC/ETH 支持）
  - network: BTC 网络类型
- 返回：钱包信息对象

##### 批量生成多链钱包
```javascript
static async generateMultipleWallets(count = 1, chains = ['BTC', 'ETH', 'SOL', 'SUI', 'TON'])
```
- 参数：
  - count: 需要生成的钱包数量
  - chains: 需要生成的链数组
- 返回：Promise<钱包组数组>

### 数据结构

#### 钱包信息对象
```typescript
interface WalletInfo {
    address: string;      // 钱包地址
    privateKey: string;   // 私钥
    publicKey?: string;   // 公钥（某些链需要）
    mnemonic?: string;    // 助记词（如果是从助记词生成）
}
```

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

3. 开发相关：
   - 支持 CommonJS 模块系统
   - 使用 ES6+ 语法特性
   - 依赖 Node.js v12 或更高版本

## 依赖说明

- ethers: 以太坊开发工具包
- @solana/web3.js: Solana 开发工具包
- @mysten/sui.js: SUI 开发工具包
- bitcoinjs-lib: 比特币开发工具包
- bip39: 助记词生成和处理
- tonweb: TON 开发工具包
- inquirer: 命令行交互界面
- ecpair: 比特币密钥对处理
- hdkey: HD 钱包工具

## License

MIT 
