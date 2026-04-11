// Placeholder config for later ethers/wagmi integration.
export const CONTRACTS = {
  devCredProfile: {
    address: "0x0000000000000000000000000000000000000000",
    functions: ["mintProfile", "getProfile"],
  },
  devCredEscrow: {
    address: "0x0000000000000000000000000000000000000000",
    functions: ["createJob", "assignDeveloper", "submitWork", "approveWork"],
  },
};

export const JOB_STATUS = ["Open", "InProgress", "Submitted", "Completed", "Cancelled"];
