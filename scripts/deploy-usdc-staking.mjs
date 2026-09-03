import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ARC Testnet config - Using Alchemy RPC for ARC Testnet
const RPC_URL = 'https://arc-testnet.g.alchemy.com/v2/7qMPL9J75Ele4ocZTFwak';
const CHAIN_ID = 5042002;
const DEPLOYER_PRIVATE_KEY = '0xREDACTED';

// USDC Token address on ARC Testnet (from Circle)
const USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'; // Native USDC on ARC

// Fee collector address
const FEE_COLLECTOR = '0x7778b915e86fBf35d9E1cB7fD5d3fD8A6c0bEBFB';

async function main() {
  console.log('🚀 Starting USDC Staking Pool Deployment on ARC Testnet...\n');

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    chainId: CHAIN_ID,
    name: 'ARC Testnet'
  });

  const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  console.log('📍 Deployer Address:', deployer.address);

  const balance = await provider.getBalance(deployer.address);
  console.log('💰 Deployer Balance:', ethers.formatEther(balance), 'ARC\n');

  // Read contract artifacts
  const stakingPoolPath = path.join(__dirname, '../artifacts/contracts/contracts/StakingPool.sol/StakingPool.json');
  const escrowPath = path.join(__dirname, '../artifacts/contracts/contracts/EscrowWithStake.sol/EscrowWithStake.json');

  if (!fs.existsSync(stakingPoolPath) || !fs.existsSync(escrowPath)) {
    console.error('❌ Contract artifacts not found! Run: npx hardhat compile');
    process.exit(1);
  }

  const stakingPoolArtifact = JSON.parse(fs.readFileSync(stakingPoolPath, 'utf8'));
  const escrowArtifact = JSON.parse(fs.readFileSync(escrowPath, 'utf8'));

  console.log('📦 Contract artifacts loaded\n');

  // Deploy StakingPool
  console.log('1️⃣ Deploying StakingPool with USDC token...');
  const StakingPoolFactory = new ethers.ContractFactory(
    stakingPoolArtifact.abi,
    stakingPoolArtifact.bytecode,
    deployer
  );

  const stakingPool = await StakingPoolFactory.deploy(USDC_ADDRESS);
  await stakingPool.waitForDeployment();
  const stakingPoolAddress = await stakingPool.getAddress();

  console.log('✅ StakingPool deployed at:', stakingPoolAddress);

  // Deploy EscrowWithStake
  console.log('\n2️⃣ Deploying EscrowWithStake...');
  const EscrowFactory = new ethers.ContractFactory(
    escrowArtifact.abi,
    escrowArtifact.bytecode,
    deployer
  );

  const escrow = await EscrowFactory.deploy(
    USDC_ADDRESS,
    stakingPoolAddress,
    FEE_COLLECTOR
  );
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  console.log('✅ EscrowWithStake deployed at:', escrowAddress);

  // Authorize Escrow in StakingPool
  console.log('\n3️⃣ Authorizing Escrow contract in StakingPool...');
  const authTx = await stakingPool.setAuthorizedContract(escrowAddress, true);
  await authTx.wait();
  console.log('✅ Escrow authorized in StakingPool');

  // Verify authorization
  const isAuthorized = await stakingPool.authorizedContracts(escrowAddress);
  console.log('🔍 Verification - Escrow authorized:', isAuthorized);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 DEPLOYMENT COMPLETE!');
  console.log('='.repeat(60));
  console.log('\n📋 Contract Addresses:');
  console.log('─'.repeat(60));
  console.log('USDC Token:      ', USDC_ADDRESS);
  console.log('StakingPool:     ', stakingPoolAddress);
  console.log('EscrowWithStake: ', escrowAddress);
  console.log('Fee Collector:   ', FEE_COLLECTOR);
  console.log('─'.repeat(60));

  // Save deployment info
  const deploymentInfo = {
    network: 'ARC Testnet',
    chainId: CHAIN_ID,
    timestamp: new Date().toISOString(),
    contracts: {
      usdcToken: USDC_ADDRESS,
      stakingPool: stakingPoolAddress,
      escrowWithStake: escrowAddress,
      feeCollector: FEE_COLLECTOR
    }
  };

  const outputPath = path.join(__dirname, '../USDC_STAKING_DEPLOYMENT.json');
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('\n💾 Deployment info saved to: USDC_STAKING_DEPLOYMENT.json');

  // Environment variables
  console.log('\n📝 Add these to your .env.local:');
  console.log('─'.repeat(60));
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${USDC_ADDRESS}`);
  console.log(`NEXT_PUBLIC_STAKING_POOL_ADDRESS=${stakingPoolAddress}`);
  console.log(`NEXT_PUBLIC_ESCROW_ADDRESS=${escrowAddress}`);
  console.log('─'.repeat(60));

  console.log('\n✨ Ready to use! Users need to:');
  console.log('1. Get USDC from Circle Faucet: https://faucet.circle.com/');
  console.log('2. Approve StakingPool to spend USDC');
  console.log('3. Stake USDC via your app');
  console.log('4. Create jobs using staked balance\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });