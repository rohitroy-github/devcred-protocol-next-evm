const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  /*
  Deploy the Starter contract and print a detailed deployment summary.
  Starter has no constructor arguments.
  */
  const contractName = "Starter";
  const compilerVersion =
    hre.config.solidity?.version ||
    hre.config.solidity?.compilers?.[0]?.version ||
    "unknown";
  const deploymentStartedAt = Date.now();
  const deployer = await ethers.provider.getSigner();
  const balanceBeforeWei = await ethers.provider.getBalance(deployer.address);

  const starter = await ethers.deployContract(contractName);
  await starter.waitForDeployment();

  const contractAddress = await starter.getAddress();
  const deploymentTx = starter.deploymentTransaction();

  if (!deploymentTx) {
    throw new Error("Deployment transaction not found.");
  }

  const receipt = await deploymentTx.wait();
  const balanceAfterWei = await ethers.provider.getBalance(deployer.address);
  const balanceSpentWei =
    balanceBeforeWei >= balanceAfterWei
      ? balanceBeforeWei - balanceAfterWei
      : 0n;
  const owner = await starter.owner();
  const deploymentDurationMs = Date.now() - deploymentStartedAt;

  console.log("\n================ Deployment Summary ================");
  console.log("Contract Name:", contractName);
  console.log("Compiler Version:", compilerVersion);
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", hre.network.config.chainId || "unknown");
  console.log("Deployer:", deployer.address);
  console.log("Deployment Tx Hash:", deploymentTx.hash);
  console.log("Deployed Block:", receipt ? receipt.blockNumber : "unknown");
  console.log("Contract Address:", `${contractAddress} ✅`);
  console.log("Contract Owner:", owner);
  console.log("Deployment Duration (sec):", (deploymentDurationMs / 1000).toFixed(2));

  console.log("\nConstructor Inputs:");
  console.log("None");

  console.log("\nDeployer Balance:");
  console.log("Balance Before (ETH):", ethers.formatEther(balanceBeforeWei));
  console.log("Balance After (ETH):", ethers.formatEther(balanceAfterWei));
  console.log("Balance Spent (ETH):", ethers.formatEther(balanceSpentWei));

  const gasUsed = receipt ? receipt.gasUsed : 0n;
  const gasPriceWei = (receipt && receipt.gasPrice) || deploymentTx.gasPrice || 0n;
  const totalCostWei = gasUsed * gasPriceWei;
  const gasPriceEth = ethers.formatEther(gasPriceWei);
  const totalCostEth = ethers.formatEther(totalCostWei);

  console.log("\nGas and Cost:");
  console.log("Gas Used:", gasUsed.toString());
  console.log("Gas Price (ETH):", gasPriceEth);
  console.log("Total Cost (ETH):", totalCostEth);
  console.log("====================================================\n");

  // Log initial contract state after deployment.
  const count = await starter.count();
  console.log(`Initial count: ${count}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
