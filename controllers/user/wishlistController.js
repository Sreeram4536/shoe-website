const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');
const STATUS_CODES = require('../../constants/statusCodes');

const loadWishlist = async(req,res)=>{
    try {

        const userId = req.session.user;
        const user = await User.findById(userId);
        const products = await Product.find({_id:{$in:user.wishlist}}).populate('category');

        res.render("user/wishlist",{user,wishlist:products,session:req.session})
        
    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound")
        
    }
}

const addToWishlist = async(req,res)=>{
    try {
        const userId = req.session.user;
        const productId = req.body.productId;
        const user = await User.findById(userId);

        const wishlist = await Wishlist.findOne({userId:userId});
        if(user.wishlist.includes(productId)){
            return res.status(STATUS_CODES.OK).json({status:false,message:"Product already in wishlist"})
        }
        user.wishlist.push(productId);
        await user.save();
        return res.status(STATUS_CODES.OK).json({status:true,message:"Product added to wishlist"})
    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({status:false,message:"Internal server error"})
    }
}

const removeFromWishlist = async(req,res)=>{
    try {
        const userId = req.session.user;
        const productId = req.query.productId;
        
        // Find the user and pull the productId from their wishlist array
        const user = await User.findByIdAndUpdate(
            userId,
            { $pull: { wishlist: productId } },
            { new: true } // This option returns the updated document
        );

        if (!user) {
            return res.status(STATUS_CODES.NOT_FOUND).json({
                status: false,
                message: "User not found"
            });
        }

        return res.redirect("/user/wishlist");
        
    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: "Internal server error"
        });
    }
}

module.exports={
    loadWishlist,
    addToWishlist,
    removeFromWishlist
}
