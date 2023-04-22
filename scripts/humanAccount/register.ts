import { ethers } from "ethers";
import {
  getHumanAccount,
  getGasFee,
  printOp,
  getHttpRpcClient,
  getVerifyingPaymaster,
} from "../../src";

import config from "../../config.json";

export default async function main(withPM: boolean) {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const deviceProvider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const paymasterAPI = withPM
    ? getVerifyingPaymaster(config.paymasterUrl, config.entryPoint)
    : undefined;

  const ownerWallet = new ethers.Wallet(config.ownerKey, provider);
  const deviceWallet = new ethers.Wallet(config.deviceKey, deviceProvider);

  const deviceAddress = await deviceWallet.getAddress();
  console.log(`Device address: ${deviceAddress}`);

  const accountAPI = getHumanAccount(
    provider,
    config.ownerKey,
    config.ownerKey,
    config.entryPoint,
    config.humanAccountFactory,
    config.humanAccountUsername,
    paymasterAPI
  );
  console.log("\nhuman account", await accountAPI.getAccountAddress());
  console.log("\nowner account", await ownerWallet.getAddress());

  const accountContract = await accountAPI._getAccountContract();

  // get code for the account contract
  const code = await provider.getCode(accountContract.address);
  // console.log(code);

  const isAccountDeployed = code !== "0x";
  const isDeviceRegistered =
    isAccountDeployed && (await accountContract.deviceKeys(deviceAddress));

  console.log(
    "isAccountDeployed",
    isAccountDeployed,
    "isDeviceRegistered",
    isDeviceRegistered
  );

  if (!isAccountDeployed || !isDeviceRegistered) {
    console.log("===registering device key", deviceAddress);
    const registerRequestHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["address"], [deviceAddress])
    );

    // sign the public key with the account's private key
    const sig = await ownerWallet.signMessage(
      ethers.utils.arrayify(registerRequestHash)
    );

    console.log("registerRequestHash, sig", registerRequestHash, sig);

    const registerOp = await accountAPI.createSignedUserOp({
      target: accountContract.address,
      value: 0,
      data: accountContract.interface.encodeFunctionData("registerDeviceKey", [
        deviceAddress,
        sig,
      ]),
      ...(await getGasFee(provider)),
    });
    console.log(`Signed UserOperation: ${await printOp(registerOp)}`);

    const client = await getHttpRpcClient(
      provider,
      config.bundlerUrl,
      config.entryPoint
    );
    const uoHash = await client.sendUserOpToBundler(registerOp);
    console.log(`UserOpHash: ${uoHash}`);

    console.log("Waiting for transaction...");
    const txHash = await accountAPI.getUserOpReceipt(uoHash);
    console.log(`Transaction hash: ${txHash}`);
  } else {
    console.log("===device key already registered", deviceAddress);
  }
}
