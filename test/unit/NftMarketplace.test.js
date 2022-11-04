const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { localChains } = require("../../helper-hardhat-config");

!localChains.includes(network.name)
  ? describe.skip
  : describe("Nft Marketplace Unit Tests", function () {
      let nftMarketplace, nftMarketplaceContract, basicNft, basicNftContract;
      const PRICE = ethers.utils.parseEther("0.1");
      const TOKEN_ID = 0;

      beforeEach(async () => {
        accounts = await ethers.getSigners(); // could also do with getNamedAccounts
        deployer = accounts[0];
        user = accounts[1];
        await deployments.fixture(["all"]);
        nftMarketplaceContract = await ethers.getContract("NFTMarketplace");
        nftMarketplace = nftMarketplaceContract.connect(deployer);
        basicNftContract = await ethers.getContract("BasicNft");
        basicNft = await basicNftContract.connect(deployer);
        await basicNft.mintNft();
        await basicNft.approve(nftMarketplaceContract.address, TOKEN_ID);
      });

      describe("listItem", function () {
        it("exclusively items that haven't been listed", async function () {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
          const error = `AlreadyListed("${basicNft.address}", ${TOKEN_ID})`;
          //   await expect(
          //       nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          //   ).to.be.revertedWith("AlreadyListed")
          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith("NFTMarketplace__alreadyListedNftAddress");
        });
        it("allows owners to list", async function () {
          nftMarketplace = nftMarketplaceContract.connect(user);
          await basicNft.approve(user.address, TOKEN_ID);
          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith("NotOwner");
        });

        it("needs approvals to list item", async function () {
          await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID);
          await expect(
            nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
          ).to.be.revertedWith("NFTMarketplace__notApprovedForMarketplace");
        });
      });

      describe("cancelListing", function () {
        it("reverts if anyone but the owner tries to call", async function () {
          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE);
          nftMarketplace = nftMarketplaceContract.connect(user);
          await basicNft.approve(user.address, TOKEN_ID);
          await expect(
            nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
          ).to.be.revertedWith("NFTMarketplace__NotOwner");
        });
      });
    });
