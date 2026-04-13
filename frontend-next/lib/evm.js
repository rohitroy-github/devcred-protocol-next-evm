import { BrowserProvider, Contract, Interface, isAddress, parseEther } from "ethers";
import { CONTRACTS, DEV_CRED_ESCROW_ABI, DEV_CRED_PROFILE_ABI } from "./contracts";

async function getBrowserProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not detected.");
  }

  const provider = new BrowserProvider(window.ethereum);
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
      try {
        return escrowInterface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((entry) => entry?.name === "JobCreated");

  const jobId = Number(createdLog?.args?.jobId);
  if (!jobId) {
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
