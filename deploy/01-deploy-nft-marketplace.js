const { network } = require("hardhat")
const { localChains, VERIFICATION_BLOCK_CONFIRMATIONS } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const waitBlockConfirmations = localChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    log("----------------------------------------------------")

    const arguments = []
    const nftMarketplace = await deploy("NFTMarketplace", {
        from: deployer,
        args: arguments,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })

    // Verify the deployment
    if (!localChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(nftargumentsMarketplace.address)
    }
    log("----------------------------------------------------")
}

module.exports.tags = ["all", "nftmarketplace"]
