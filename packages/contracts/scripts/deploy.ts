import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);

  const SafetyRegistry = await ethers.getContractFactory('SafetyRegistry');
  const registry = await SafetyRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log('SafetyRegistry deployed to:', address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
