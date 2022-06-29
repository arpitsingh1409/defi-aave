const { getNamedAccounts, ethers } = require("hardhat");
const { getWeth, AMOUNT } = require("../scripts/getWeth");

async function main() {
  const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const daiTokenAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";
  await getWeth();
  const { deployer } = await getNamedAccounts();
  const lendingPool = await getLendingPool(deployer);
  console.log(`LendingPool address ${lendingPool.address}`);
  await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer);
  console.log(`Depositing.....`);
  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);
  console.log(`Deposited`);
  let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(
    lendingPool,
    deployer
  );

  const daiPrice = await getDaiPrice();
  const amountDaiToBorrow =
    availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber());
  console.log(`You can borrow ${amountDaiToBorrow} DAI`);

  const amountDaiToBorrowWei = ethers.utils.parseEther(
    amountDaiToBorrow.toString()
  );

  await borrowDai(
    "0x6b175474e89094c44da98b954eedeac495271d0f",
    lendingPool,
    amountDaiToBorrowWei,
    deployer
  );

  await getBorrowUserData(lendingPool, deployer);

  await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer);

  await getBorrowUserData(lendingPool, deployer);
}

async function repay(amount, daiAddress, lendingPool, account) {
  await approveErc20(daiAddress, lendingPool.address, amount, account);
  const repayTx = await lendingPool.repay(daiAddress, amount, 1, account);
  await repayTx.wait(1);
  console.log(`Repayed!`);
}

async function borrowDai(
  daiAddress,
  lendingPool,
  amountDaiToBorrowWei,
  account
) {
  const borrowTx = await lendingPool.borrow(
    daiAddress,
    amountDaiToBorrowWei,
    1,
    0,
    account
  );
  await borrowTx.wait(1);
  console.log(`Borrowed!`);
}

async function getDaiPrice() {
  const daiEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    "0x773616E4d11A78F511299002da57A0a94577F1f4"
  );
  // No signer needed as we are not writing any data (making a transaction). We are just reading data, hence no transaction made!
  const price = (await daiEthPriceFeed.latestRoundData())[1]; //grab first index return from all the returns
  console.log(`The DAI/ETH price is ${price.toString()}`);
  return price;
}

async function getBorrowUserData(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await lendingPool.getUserAccountData(account);
  console.log(
    `You have total ${ethers.utils.formatUnits(
      totalCollateralETH,
      "ether"
    )} worth of ETH deposited.`
  );
  console.log(
    `You have total ${ethers.utils.formatUnits(
      totalDebtETH,
      "ether"
    )} worth of ETH borrowed.`
  );
  console.log(
    `You can borrow ${ethers.utils.formatUnits(
      availableBorrowsETH,
      "ether"
    )} worth of ETH.`
  );
  return { availableBorrowsETH, totalDebtETH };
}

async function getLendingPool(account) {
  const lendingPoolAddressProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    account
  );

  const lendingPoolAddress = await lendingPoolAddressProvider.getLendingPool();
  const lendingPool = await ethers.getContractAt(
    "ILendingPool",
    lendingPoolAddress,
    account
  );

  return lendingPool;
}

async function approveErc20(
  erc20Address,
  spenderAddress,
  amountToSpend,
  account
) {
  const erc20Token = await ethers.getContractAt(
    "IERC20",
    erc20Address,
    account
  );

  const tx = await erc20Token.approve(spenderAddress, amountToSpend);
  await tx.wait(1);
  console.log(`Approved!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
