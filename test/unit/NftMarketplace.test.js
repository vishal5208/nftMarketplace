const { assert, expect, use } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { localChains } = require("../../helper-hardhat-config")

!localChains.includes(network.name)
    ? describe.skip
    : describe("NFTMarketplace Uint Test", function () {
          let accounts, deployer, user
          const TOKEN_ID = 0
          const PRICE = ethers.utils.parseEther("0.1")
          beforeEach(async function () {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              await deployments.fixture(["all"])
              contractNftMarketplace = await ethers.getContract("NFTMarketplace")
              nftMarketplace = contractNftMarketplace.connect(deployer)
              contractBasicNft = await ethers.getContract("BasicNft")
              basicNft = contractBasicNft.connect(deployer)
              await basicNft.mintNft()
              await basicNft.approve(contractNftMarketplace.address, TOKEN_ID)
          })

          describe("listItem", function () {
              it("emits an event after listing an item", async function () {
                  const txRes = await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(txRes).to.emit(nftMarketplace, "ItemListed")
              })

              it("don't allow item that is listed on marketplace before", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NFTMarketplace__alreadyListedNftAddress")
              })

              it("allows only owner to list", async function () {
                  nftMarketplace = contractNftMarketplace.connect(user)
                  // approve : Approves another address to transfer the given token ID

                  await basicNft.approve(user.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NFTMarketplace__NotOwner")
              })

              it("needs approvals to list item", async function () {
                  // approve zero address to transfer nft
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NFTMarketplace__notApprovedForMarketplace")
              })

              it("updates listing with seller and price", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == PRICE.toString())
                  assert(listing.seller.toString() == deployer.address)
              })
          })

          describe("cancelListing", function () {
              it("reverts if there is no listing", async function () {
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NFTMarketplace__NotListed")
              })

              it("reverts if other than owner calls to cancel item", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace = contractNftMarketplace.connect(user)
                  await basicNft.approve(user.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NFTMarketplace__NotOwner")
              })

              it("emits event on item cancelled and remvoe listing", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
                      nftMarketplace,
                      "ItemCanceled"
                  )
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == "0")
              })
          })

          describe("buyItem", function () {
              it("reverts if there is no listing", async function () {
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NFTMarketplace__NotListed")
              })

              it("reverts if the price isn't met", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NFTMarketplace__PriceNotMet")
              })

              it("transfers the nft to the buyer and updates the inner proceeds record", async function () {
                  // list the item who has deployer as owner
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  // connect user to the contract
                  nftMarketplace = contractNftMarketplace.connect(user)
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                  ).to.emit(nftMarketplace, "ItemBought")

                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const proceeds = await nftMarketplace.getProceeds(deployer.address)

                  // proceeds of deployer is the price
                  assert(proceeds.toString() == PRICE.toString())
                  assert(newOwner.toString() == user.address)
              })
          })

          describe("updateListing", function () {
              it("must be owner and listed", async function () {
                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotListed")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace = contractNftMarketplace.connect(user)
                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotOwner")
              })

              it("updates the price of the item", async function () {
                  const updatedPrice = ethers.utils.parseEther("0.2")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(
                      await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, updatedPrice)
                  ).to.emit(nftMarketplace, "ItemListed")
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == updatedPrice.toString())
              })
          })

          describe("withdrawProceeds", function () {
              it("doesn't allow 0 proceed withdrawls", async function () {
                  await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith("NoProceeds")
              })

              it("withdraw proceeds", async function () {
                  // deployer list the item and he is the owner
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                  // user is now the onwer of the nft
                  nftMarketplace = contractNftMarketplace.connect(user)
                  await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })

                  // again deployer connected to the contract
                  nftMarketplace = contractNftMarketplace.connect(deployer)

                  // depoyer proceeds and balance before the wihtdrawProceeds functions
                  const deployerProceedsBefore = await nftMarketplace.getProceeds(deployer.address)
                  const deployerBalanceBefore = await deployer.getBalance()

                  // deployer performs withdrawProceeds
                  const txRes = await nftMarketplace.withdrawProceeds()
                  const txRec = await txRes.wait(1)

                  // how much gasUsed and effectiveGasPrice from txRec
                  const { gasUsed, effectiveGasPrice } = txRec

                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  console.log(`Gas Cost : ${gasCost.toNumber()}`)
                  const deployerBalanceAfter = await deployer.getBalance()

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerProceedsBefore.add(deployerBalanceBefore).toString()
                  )
              })
          })
      })
