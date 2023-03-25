import { getHumanAccount } from "../../src";
import { ethers } from "ethers";
// @ts-ignore
import config from "../../config.json";

export default async function main() {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);

  const accountAPI = getHumanAccount(
    provider,
    config.ownerKey,
    config.ownerKey,
    config.entryPoint,
    config.humanAccountFactory,
    config.humanAccountUsername
  );
  const address = await accountAPI.getCounterFactualAddress();

  console.log(`HumanAccount address: ${address}`);
}
