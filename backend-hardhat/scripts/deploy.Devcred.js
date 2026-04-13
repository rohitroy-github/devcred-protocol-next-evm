/*
Deployment workflow:
1) Read network and deployer context, then print pre-deployment metadata.
2) Deploy DevCredProfile first (no constructor arguments).
3) Deploy DevCredEscrow with DevCredProfile address as constructor input.
4) Transfer DevCredProfile ownership to DevCredEscrow so onlyOwner
  updateReputation calls can be executed by escrow during approveWork.
5) Print wiring checks, contract addresses, gas/cost details, and
  deployer balance summary.
*/

const hre = require("hardhat");
const { ethers } = hre;

function getCompilerVersion() {
  return (
    hre.config.solidity?.version ||
    hre.config.solidity?.compilers?.[0]?.version ||
    "unknown"
  );
}

async function deployWithSummary(contractName, constructorArgs, deployerAddress) {
  const startedAt = Date.now();
  const contract = await ethers.deployContract(contractName, constructorArgs);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();

  if (!deploymentTx) {
    throw new Error(`Deployment transaction not found for ${contractName}.`);
  }

  const receipt = await deploymentTx.wait();
  const durationMs = Date.now() - startedAt;
  const gasUsed = receipt ? receipt.gasUsed : 0n;
  const gasPriceWei = (receipt && receipt.gasPrice) || deploymentTx.gasPrice || 0n;
  const totalCostWei = gasUsed * gasPriceWei;

  console.log("\n---------------- Contract Deployment ----------------");
  console.log("Contract Name:", contractName);
  console.log("Deployer:", deployerAddress);
  console.log("Deployment Tx Hash:", deploymentTx.hash);
  console.log("Deployed Block:", receipt ? receipt.blockNumber : "unknown");
  console.log("Contract Address:", `${contractAddress} ✅`);
  console.log("Deployment Duration (sec):", (durationMs / 1000).toFixed(2));
  console.log("Constructor Inputs:", constructorArgs.length ? constructorArgs : "None");
  console.log("Gas Used:", gasUsed.toString());
  console.log("Gas Price (ETH):", ethers.formatEther(gasPriceWei));
  console.log("Total Cost (ETH):", ethers.formatEther(totalCostWei));
  console.log("----------------------------------------------------");

  return {
    contract,
    contractAddress,
    deploymentTx,
    receipt,
    gasUsed,
    gasPriceWei,
    totalCostWei,
  };
}

async function main() {
  const deploymentStartedAt = Date.now();
  const deployer = await ethers.provider.getSigner();
  const compilerVersion = getCompilerVersion();
  const balanceBeforeWei = await ethers.provider.getBalance(deployer.address);

  console.log("\n================ Deployment Summary ================");
  console.log("Compiler Version:", compilerVersion);
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", hre.network.config.chainId || "unknown");
  console.log("Deployer:", deployer.address);

  // 1) Deploy DevCredProfile
  const profileResult = await deployWithSummary("DevCredProfile", [], deployer.address);

  // 2) Deploy DevCredEscrow with profile address
  const escrowResult = await deployWithSummary(
    "DevCredEscrow",
    [profileResult.contractAddress],
    deployer.address
  );

  // 3) Transfer profile ownership to escrow so escrow can call onlyOwner updateReputation
  const transferTx = await profileResult.contract.transferOwnership(escrowResult.contractAddress);
  const transferReceipt = await transferTx.wait();

  const profileOwner = await profileResult.contract.owner();
  const escrowProfileAddress = await escrowResult.contract.profileContract();
  const balanceAfterWei = await ethers.provider.getBalance(deployer.address);
  const balanceSpentWei =
    balanceBeforeWei >= balanceAfterWei ? balanceBeforeWei - balanceAfterWei : 0n;

  const totalDeploymentCostWei =
    profileResult.totalCostWei + escrowResult.totalCostWei +
    ((transferReceipt ? transferReceipt.gasUsed : 0n) *
      ((transferReceipt && transferReceipt.gasPrice) || transferTx.gasPrice || 0n));

  const deploymentDurationMs = Date.now() - deploymentStartedAt;

  console.log("\n---------------- Ownership & Wiring ----------------");
  console.log("Profile ownership transfer tx:", transferTx.hash);
  console.log("Profile owner after transfer:", profileOwner);
  console.log("Escrow profileContract():", escrowProfileAddress);
  console.log("----------------------------------------------------");

  console.log("\n---------------- Final Addresses --------------------");
  console.log("DevCredProfile:", `${profileResult.contractAddress} ✅`);
  console.log("DevCredEscrow:", `${escrowResult.contractAddress} ✅`);
  console.log("----------------------------------------------------");

  console.log("\nDeployer Balance:");
  console.log("Balance Before (ETH):", ethers.formatEther(balanceBeforeWei));
  console.log("Balance After (ETH):", ethers.formatEther(balanceAfterWei));
  console.log("Balance Spent (ETH):", ethers.formatEther(balanceSpentWei));

  console.log("\nCombined Deployment Cost (ETH):", ethers.formatEther(totalDeploymentCostWei));
  console.log("Total Deployment Duration (sec):", (deploymentDurationMs / 1000).toFixed(2));
  console.log("====================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
