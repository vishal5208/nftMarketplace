// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

error NFTMarketplace__priceMustBeAboveZero();
error NFTMarketplace__notApprovedForMarketplace();
error NFTMarketplace__alreadyListedNftAddress(
    address nftAddress,
    uint256 tokenId
);
error NFTMarketplace__NotOwner();
error NFTMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NFTMarketplace__PriceNotMet(
    address nftAddress,
    uint256 tokenId,
    uint256 price
);
error NFTMarketplace__NoProceeds();
error NFTMarketplace__TransferFailed();

contract NFTMarketplace is ReentrancyGuard {
    //////////////
    // Structs //
    ////////////

    // Listing : price and seller of the nft
    struct Listing {
        uint256 price;
        address seller;
    }

    /////////////
    // Events //
    ///////////

    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );
    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemCanceled(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId
    );

    ///////////////
    // Mappings //
    /////////////

    // nft-contract-address -> tokenId -> Listing
    mapping(address => mapping(uint256 => Listing)) private s_listings;
    // seller address -> amount earned
    mapping(address => uint256) private s_proceeds;

    /////////////////
    // Modifiers  //
    ///////////////

    modifier notListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price > 0) {
            revert NFTMarketplace__alreadyListedNftAddress(nftAddress, tokenId);
        }

        _;
    }

    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (spender != owner) {
            revert NFTMarketplace__NotOwner();
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price < 0) {
            revert NFTMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    /////////////////////
    // Main functions //
    ///////////////////

    /**
     * @dev List nfts on marketplace
     * @param nftAddress address of the nft
     * @param tokenId tokenId of the nft
     * @param price sale price of listed nft
     */
    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    )
        external
        notListed(nftAddress, tokenId)
        isOwner(nftAddress, tokenId, msg.sender)
    {
        if (price <= 0) {
            revert NFTMarketplace__priceMustBeAboveZero();
        }

        IERC721 nft = IERC721(nftAddress);

        // if not approved by the contract then revert back with the errro
        if (nft.getApproved(tokenId) != address(this)) {
            revert NFTMarketplace__notApprovedForMarketplace();
        }

        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    /**
     * @dev Buy nft which is listed on marketplace
     * @param nftAddress address of the nft
     * @param tokenId tokenId of the nft
     */
    function buyItem(address nftAddress, uint256 tokenId)
        external
        payable
        nonReentrant
        isListed(nftAddress, tokenId)
    {
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        IERC721 nft = IERC721(nftAddress);
        if (msg.value < listedItem.price) {
            revert NFTMarketplace__PriceNotMet(
                nftAddress,
                tokenId,
                listedItem.price
            );
        }

        // increase the proceeds of seller
        s_proceeds[listedItem.seller] += msg.value;

        // owner(seller) has lost the control over nft
        delete (s_listings[nftAddress][tokenId]);

        // transfer nft from owner(seller) of the nft to msg.sender
        nft.safeTransferFrom(listedItem.seller, msg.sender, tokenId);
        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);
    }

    /**
     * @dev cancel the listed nft
     * @param nftAddress address of the nft
     * @param tokenId tokenId of the nft
     */
    function cancelListing(address nftAddress, uint256 tokenId)
        external
        isOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
    {
        delete (s_listings[nftAddress][tokenId]);
        emit ItemCanceled(msg.sender, nftAddress, tokenId);
    }

    /**
     * @dev updaet the price of nft
     * @param nftAddress address of the nft
     * @param tokenId tokenId of the nft
     * @param newPrice new price to be given to the nft
     */
    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    )
        external
        isOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
    {
        s_listings[nftAddress][tokenId].price = newPrice;
        emit ItemListed(msg.sender, nftAddress, tokenId, newPrice);
    }

    /**
     * @dev withdraw proceeds that caller has which he/she earned by selling nft
     */
    function withdrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NFTMarketplace__NoProceeds();
        }
        s_proceeds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        if (!success) {
            revert NFTMarketplace__TransferFailed();
        }
    }

    ///////////////////////
    // Getter functions //
    /////////////////////

    function getListing(address nftAddress, uint256 tokenId)
        external
        view
        returns (Listing memory)
    {
        return s_listings[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }
}
