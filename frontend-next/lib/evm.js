import { BrowserProvider, Contract, Interface, isAddress, parseEther } from "ethers";
import { CONTRACTS, DEV_CRED_ESCROW_ABI, DEV_CRED_PROFILE_ABI } from "./contracts";

const LOCAL_CHAIN_ID = "0x7a69";

function isPreferredMetaMaskProvider(provider) {
  return Boolean(
    provider?.isMetaMask &&
      !provider?.isBraveWallet &&
      !provider?.isRabby &&
      !provider?.isFrame &&
      !provider?.isOkxWallet &&
      !provider?.isOKExWallet &&
      !provider?.isBitKeep &&
      !provider?.isBitgetWallet &&
      !provider?.isCoinbaseWallet
  );
}

function getInjectedProvider() {
  if (typeof window === "undefined") return null;
  const injected = window.ethereum;
  if (!injected) return null;

  if (Array.isArray(injected.providers) && injected.providers.length > 0) {
    return injected.providers.find(isPreferredMetaMaskProvider) || injected.providers[0];
  }

  return injected;
}

async function ensureLocalHardhatNetwork(provider) {
  const chainId = await provider.request({ method: "eth_chainId" });
  if (chainId === LOCAL_CHAIN_ID) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: LOCAL_CHAIN_ID }],
    });
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: LOCAL_CHAIN_ID,
            chainName: "Hardhat Localhost",
            nativeCurrency: {
              name: "Ether",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["http://127.0.0.1:8545"],
          },
        ],
      });
      return;
    }

    throw new Error("Switch MetaMask to Hardhat Localhost (chain id 31337).");
  }
}

async function getBrowserProvider() {
  const injectedProvider = getInjectedProvider();
  if (!injectedProvider) {
    throw new Error("MetaMask not detected.");
  }

  if (!isPreferredMetaMaskProvider(injectedProvider)) {
    throw new Error("MetaMask is not the active wallet provider. Disable other wallet extensions or make MetaMask the active provider.");
  }

  await ensureLocalHardhatNetwork(injectedProvider);

  const provider = new BrowserProvider(injectedProvider);
  await provider.send("eth_requestAccounts", []);
  return provider;
}

async function getSigner() {
  const provider = await getBrowserProvider();
  return provider.getSigner();
}

export async function getConnectedAddress() {
  const provider = await getBrowserProvider();
  const signer = await provider.getSigner();
  return signer.getAddress();
}

export async function mintProfileOnChain() {
  const signer = await getSigner();
  const profile = new Contract(
    CONTRACTS.devCredProfile.address,
    DEV_CRED_PROFILE_ABI,
    signer
  );

  const tx = await profile.mintProfile();
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function getProfileOnChain(walletAddress) {
  if (!isAddress(walletAddress)) {
    return null;
  }

  const provider = await getBrowserProvider();
  const profileContract = new Contract(
    CONTRACTS.devCredProfile.address,
    DEV_CRED_PROFILE_ABI,
    provider
  );

  const tokenId = await profileContract.addressToProfile(walletAddress);
  if (tokenId === 0n) {
    return null;
  }

  const onChainProfile = await profileContract.getProfile(walletAddress);

  return {
    walletAddress: walletAddress.toLowerCase(),
    tokenId: Number(tokenId),
    reputation: Number(onChainProfile.reputation),
    completedJobs: Number(onChainProfile.completedJobs),
  };
}

export async function createJobOnChain({ amountEth, developer }) {
  if (!amountEth || Number(amountEth) <= 0) {
    throw new Error("Budget must be greater than zero.");
  }

  if (developer && !isAddress(developer)) {
    throw new Error("Developer address is invalid.");
  }

  const signer = await getSigner();
  const signerAddress = await signer.getAddress();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    signer
  );

  const createTx = await escrow.createJob({ value: parseEther(amountEth) });
  const createReceipt = await createTx.wait();
  const escrowInterface = new Interface(DEV_CRED_ESCROW_ABI);

  const createdLog = createReceipt.logs
    .map((log) => {
      if (log?.fragment?.name === "JobCreated") {
        return log;
      }

      try {
        return escrowInterface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((entry) => entry?.name === "JobCreated");

  const parsedJobId = createdLog?.args?.jobId ?? createdLog?.args?.[0];
  const fallbackJobId = parsedJobId ?? (await escrow.nextJobId());
  const jobId = Number(fallbackJobId);

  if (!Number.isInteger(jobId) || jobId < 1) {
    throw new Error("Unable to detect created job id from transaction receipt.");
  }

  let assignReceipt = null;
  if (developer) {
    const assignTx = await escrow.assignDeveloper(jobId, developer);
    assignReceipt = await assignTx.wait();
  }

  return {
    jobId,
    client: signerAddress.toLowerCase(),
    amount: amountEth,
    isMilestoneJob: false,
    createTxHash: createReceipt.hash,
    assignTxHash: assignReceipt?.hash || "",
  };
}

export async function assignDeveloperOnChain(jobId, developer) {
  if (!isAddress(developer)) {
    throw new Error("Developer address is invalid.");
  }

  const signer = await getSigner();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    signer
  );

  const tx = await escrow.assignDeveloper(jobId, developer);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function submitWorkOnChain(jobId) {
  const signer = await getSigner();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    signer
  );

  const tx = await escrow.submitWork(jobId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function approveWorkOnChain(jobId) {
  const signer = await getSigner();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    signer
  );

  const tx = await escrow.approveWork(jobId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function cancelJobOnChain(jobId) {
  const signer = await getSigner();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    signer
  );

  const tx = await escrow.cancelJob(jobId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function autoReleaseFundsOnChain(jobId) {
  const signer = await getSigner();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    signer
  );

  const tx = await escrow.autoReleaseFunds(jobId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

// ======= MILESTONE-BASED JOB FUNCTIONS =======

export async function createJobWithMilestonesOnChain({ milestoneAmounts, developer }) {
  if (!milestoneAmounts || milestoneAmounts.length === 0) {
    throw new Error("At least one milestone is required.");
  }

  if (milestoneAmounts.some(amount => Number(amount) <= 0)) {
    throw new Error("Each milestone amount must be greater than zero.");
  }

  if (developer && !isAddress(developer)) {
    throw new Error("Developer address is invalid.");
  }

  const signer = await getSigner();
  const signerAddress = await signer.getAddress();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    signer
  );

  // Convert milestone amounts to wei
  const milestoneAmountsWei = milestoneAmounts.map(amount => parseEther(String(amount)));
  
  // Calculate total amount to send
  const totalAmount = milestoneAmountsWei.reduce((sum, amount) => sum + amount, 0n);

  const createTx = await escrow.createJobWithMilestones(milestoneAmountsWei, { value: totalAmount });
  const createReceipt = await createTx.wait();
  const escrowInterface = new Interface(DEV_CRED_ESCROW_ABI);

  const createdLog = createReceipt.logs
    .map((log) => {
      if (log?.fragment?.name === "JobCreated") {
        return log;
      }

      try {
        return escrowInterface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((entry) => entry?.name === "JobCreated");

  const parsedJobId = createdLog?.args?.jobId ?? createdLog?.args?.[0];
  const fallbackJobId = parsedJobId ?? (await escrow.nextJobId());
  const jobId = Number(fallbackJobId);

  if (!Number.isInteger(jobId) || jobId < 1) {
    throw new Error("Unable to detect created job id from transaction receipt.");
  }

  let assignReceipt = null;
  if (developer) {
    const assignTx = await escrow.assignDeveloper(jobId, developer);
    assignReceipt = await assignTx.wait();
  }

  return {
    jobId,
    client: signerAddress.toLowerCase(),
    totalAmount: milestoneAmounts.reduce((sum, amount) => Number(sum) + Number(amount), 0),
    milestoneAmounts,
    isMilestoneJob: true,
    createTxHash: createReceipt.hash,
    assignTxHash: assignReceipt?.hash || "",
  };
}

export async function submitMilestoneOnChain(jobId) {
  const signer = await getSigner();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    signer
  );

  const tx = await escrow.submitMilestone(jobId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function approveMilestoneOnChain(jobId) {
  const signer = await getSigner();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    signer
  );

  const tx = await escrow.approveMilestone(jobId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function rejectMilestoneOnChain(jobId) {
  const signer = await getSigner();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    signer
  );

  const tx = await escrow.rejectMilestone(jobId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

export async function autoReleaseMilestoneOnChain(jobId) {
  const signer = await getSigner();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    signer
  );

  const tx = await escrow.autoReleaseMilestone(jobId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

/**
 * Get detailed job information including milestone data if applicable
 * @param {number} jobId - The ID of the job
 * @returns {Object} Job object with all details
 */
export async function getJobOnChain(jobId) {
  const provider = await getBrowserProvider();
  const escrow = new Contract(
    CONTRACTS.devCredEscrow.address,
    DEV_CRED_ESCROW_ABI,
    provider
  );

  const jobData = await escrow.jobs(jobId);
  
  const jobObj = {
    jobId,
    client: jobData.client.toLowerCase(),
    developer: jobData.developer === "0x0000000000000000000000000000000000000000" 
      ? null 
      : jobData.developer.toLowerCase(),
    amount: jobData.amount.toString(),
    status: Number(jobData.status),
    submittedAt: Number(jobData.submittedAt),
    isMilestoneJob: jobData.isMilestoneJob ?? false,
    currentMilestoneIndex: Number(jobData.currentMilestoneIndex ?? 0),
  };

  // For milestone jobs, fetch milestone details
  if (jobObj.isMilestoneJob) {
    const milestoneCount = await escrow.getMilestoneCount(jobId);
    jobObj.milestoneCount = Number(milestoneCount);
    
    // Fetch all milestones
    const milestonesData = await escrow.getJobMilestones(jobId);
    jobObj.milestones = milestonesData.map((milestone, index) => ({
      index,
      amount: milestone.amount.toString(),
      status: Number(milestone.status),
      submittedAt: Number(milestone.submittedAt),
    }));
  }

  return jobObj;
}
