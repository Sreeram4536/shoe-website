const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const nodemailer=require("nodemailer");
const bcrypt = require('bcrypt');
const env = require("dotenv").config();
const seesion=require("express-session");
const { session } = require("passport");
const Wallet = require("../../models/walletSchema");
const Product = require("../../models/productSchema");
const STATUS_CODES = require('../../constants/statusCodes');

function generateOtp(){
    const digits="1234567890";
    let otp ="";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)];
    }
    return otp;
}

const sendVerificationEmail = async(email,otp)=>{
    try {

        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
            }
        });
        const mailOptions={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your OTP for password reset",
            text:`Your OTP is ${otp}`,
            html:`<b><h4>Your OTP: ${otp}</h4></b>`
        }

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:",info.messageId);
        return true;
    
    } catch (error) {

        console.error("Error in sending email",error)
        return false;
        
    }
}

const securePassword = async(password)=>{
    try {

        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash;
        
    } catch (error) {
        
    }
}

const getForgotPassPage= async(req,res)=>{
    try {

        res.render("user/forgot-password")
        
    } catch (error) {
       res.redirect("/pageNotFound")
    }
}

const forgotEmailValid=async(req,res)=>{
    try {

        const {email}=req.body;
        const findUser=await User.findOne({email:email});
        if(findUser){
            const otp=generateOtp();
            const emailSent = await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp = otp;
                req.session.email=email;
                res.render("user/forgotPass-otp");
                console.log("OTP:",otp);
            }else{
                res.json({success:false,message:"Failed to send OTP,Please try again"})
            }
        }else{
            res.render("user/forgot-password",{message:"User with this email doesnot exist"})
        }
        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const verifyForgotPassOtp = async (req,res)=>{
    try {

        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            res.json({success:true,redirectUrl:"/user/reset-password"});
        }else{
            res.json({success:false,message:"OTP not matching"})
        }
        
    } catch (error) {
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false,message:"An error occured.Please try again"})
        
    }
}

const getResetPassPage = async(req,res)=>{
    try {

        res.render("user/reset-password")
        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const resendOtp =  async(req,res)=>{
    try {

        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("Resending OTP to email:",email);
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(STATUS_CODES.OK).json({success:true,message:"Resend OTP successful"});
            
        }
        

    } catch (error) {
        console.error("Error in resend otp:",error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({success:false,message:"Internal server error"})
    }
}

const postNewPassword = async(req,res)=>{
    try {

        const{newPass1,newPass2}=req.body;
        const email= req.session.email;
        if(newPass1===newPass2){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            )
            res.redirect("/user/login")
        }else{
            res.render("user/reset-password",{message:"Password doesnot match"})
        }
        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const userProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const addressData = await Address.findOne({ userId: userId });

        // Pagination for orders
        const ordersPage = parseInt(req.query.ordersPage) || 1; // Current orders page
        const ordersLimit = 3; // Number of orders per page
        const ordersSkip = (ordersPage - 1) * ordersLimit; // Calculate how many orders to skip

        const orders = await Order.find({ userId: req.session.user })
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage'
            })
            .skip(ordersSkip)
            .limit(ordersLimit);

        const totalOrders = await Order.countDocuments({ userId: req.session.user });
        const totalPagesOrders = Math.ceil(totalOrders / ordersLimit);

        // Pagination for wallet history
        const walletPage = parseInt(req.query.walletPage) || 1; // Current wallet page
        const walletLimit = 5; // Number of transactions per page
        const walletSkip = (walletPage - 1) * walletLimit; // Calculate how many transactions to skip

        const walletData = await Wallet.findOne({ userId: userId });
        const transactions = walletData.transactions.slice(walletSkip, walletSkip + walletLimit);
        const totalWalletPages = Math.ceil(walletData.transactions.length / walletLimit);

        res.render('user/profile', {
            user: userData,
            userAddress: addressData,
            orders: orders,
            currentOrdersPage: ordersPage,
            totalPagesOrders: totalPagesOrders,
            walletData: walletData || { transactions: [] },
            currentWalletPage: walletPage,
            totalWalletPages: totalWalletPages,
            activeTab: req.query.tab || 'dashboard',
            session:req.session,
            limit:ordersLimit // Pass the active tab to the view
        });
    } catch (error) {
        console.error("Error retrieving profile:", error);
        res.redirect("/pageNotFound");
    }
};

const changeEmail = async(req,res)=>{
    try {

        res.render("user/change-email",{session:req.session})
        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const changeEmailValid = async(req,res) => {
    try {
        const {email} = req.body;
        const userExists = await User.findOne({email});
        
        if(userExists){
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp = otp;
                req.session.userData = req.body;
                req.session.email = email;
                console.log("Email sent:", email);
                console.log("OTP:", otp);
                
                res.json({ 
                    success: true,
                    message: "OTP sent successfully",
                    redirectUrl: '/user/change-email-otp'
                });
            } else {
                res.json({ 
                    success: false,
                    message: "Failed to send OTP. Please try again."
                });
            }
        } else {
            res.json({ 
                success: false,
                message: "User with this email does not exist"
            });
        }
    } catch (error) {
        console.error("Error in changeEmailValid:", error);
        res.json({ 
            success: false,
            message: "An error occurred. Please try again."
        });
    }
}

const changeEmailOtpPage = async(req, res) => {
    try {
        if (!req.session.userOtp || !req.session.email) {
            return res.redirect('/user/change-email');
        }
        res.render('user/change-email-otp', {
            session: req.session,
            userData: req.session.userData || {}
        });
    } catch (error) {
        console.error("Error in changeEmailOtpPage:", error);
        res.redirect('/user/change-email');
    }
}

const verifyEmailOtp = async(req, res) => {
    try {
        const enteredOtp = req.body.otp?.toString().trim();
        const sessionOtp = req.session.userOtp?.toString().trim();
        
        console.log("Entered OTP:", enteredOtp);
        console.log("Session OTP:", sessionOtp);

        if (enteredOtp === sessionOtp) {
            // OTP matches
            res.json({
                success: true,
                message: "OTP verified successfully",
                redirectUrl: "/user/new-email"
            });
        } else {
            // OTP doesn't match
            res.json({
                success: false,
                message: "Invalid OTP. Please try again."
            });
        }
    } catch (error) {
        console.error("Error in verifyEmailOtp:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "An error occurred. Please try again."
        });
    }
}

const updateEmail = async(req,res)=>{
    try {

        const newEmail = req.body.newEmail;
        const userId = req.session.user;
        await User.findByIdAndUpdate(userId,{email:newEmail});
        res.redirect("/user/userProfile")

        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const changePassword = async(req,res)=>{
    try {

        res.render("user/change-password",{session:req.session})
        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const changePasswordValid = async(req,res) => {
    try {
        const {email} = req.body;
        const userExists = await User.findOne({email});
        
        if(userExists) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp);
            if(emailSent) {
                req.session.userOtp = otp;
                req.session.userData = req.body;
                req.session.email = email;
                console.log("OTP:", otp);
                
                res.json({ 
                    success: true,
                    message: "OTP sent successfully",
                    redirectUrl: '/user/change-password-otp'
                });
            } else {
                res.json({ 
                    success: false,
                    message: "Failed to send OTP. Please try again."
                });
            }
        } else {
            res.json({ 
                success: false,
                message: "User with this email does not exist"
            });
        }
    } catch (error) {
        console.error("Error in changePasswordValid:", error);
        res.json({ 
            success: false,
            message: "An error occurred. Please try again."
        });
    }
}

const verifyChangePassOtp = async(req,res) => {
    try {
        const enteredOtp = req.body.otp?.toString().trim();
        const sessionOtp = req.session.userOtp?.toString().trim();
        
        if (enteredOtp === sessionOtp) {
            res.json({
                success: true,
                message: "OTP verified successfully",
                redirectUrl: "/user/reset-password"
            });
        } else {
            res.json({
                success: false,
                message: "Invalid OTP. Please try again."
            });
        }
    } catch (error) {
        console.error("Error in verifyChangePassOtp:", error);
        res.json({
            success: false,
            message: "An error occurred. Please try again."
        });
    }
}

const addAddress = async (req,res)=>{
    try {

        const user = req.session.user;
        res.render("user/add-address",{user:user,session:req.session})
        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const postAddAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({_id: userId});
        const {addressType, name, city, landMark, state, pincode, phone, altPhone} = req.body;
        
        const userAddress = await Address.findOne({userId: userData._id});
        
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{addressType, name, city, landMark, state, pincode, phone, altPhone}]
            });
            await newAddress.save();
        } else {
            userAddress.address.push({addressType, name, city, landMark, state, pincode, phone, altPhone});
            await userAddress.save();
        }
        
        res.json({
            success: true,
            message: 'Address added successfully'
        });
    } catch (error) {
        console.error("Error in adding address", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to add address'
        });
    }
}

const editAddress= async(req,res)=>{
    try {
        const addressId = req.query.id;
        const user = req.session.user;
        const currAddress = await Address.findOne({
            "address._id":addressId,
        })
        if(!currAddress){
            return res.redirect("/pageNotFound")
        }

        const addressData = currAddress.address.find((item)=>{
            return item._id.toString()===addressId.toString();
        })

        if(!addressData){
            return res.redirect("/pageNotFound")
        }
        res.render("user/edit-address",{address:addressData, user:user, session:req.session})
        
    } catch (error) {
        console.error("Error in editing address",error)
        res.redirect("/pageNotFound")
    }
}

const postEditAddress = async (req, res) => {
    try {
        const data = req.body;
        const addressId = req.query.id || data.addressId;
        console.log("address id is:",req.session);
        

        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.status(STATUS_CODES.NOT_FOUND).json({
                success: false,
                message: 'Address not found'
            });
        }

        // Update the address
        await Address.updateOne(
            { "address._id": addressId },
            { $set: {
                "address.$": {
                    _id: addressId,
                    addressType: data.addressType,
                    name: data.name,
                    city: data.city,
                    landMark: data.landMark,
                    state: data.state,
                    pincode: data.pincode,
                    phone: data.phone,
                    altPhone: data.altPhone
                }
            }}
        );
        
        // Return the updated address
        const updatedAddress = await Address.findOne({ "address._id": addressId });
         return res.json({
            success: true,
            message: 'Address updated successfully',
            updatedAddress: updatedAddress.address.find(addr => addr._id.toString() === addressId)
        });
        
    } catch (error) {
        console.error("Error in edit address", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to update address'
        });
    }

    
}

const deleteAddress = async(req,res)=>{
    try {
        const addressId = req.query.id;
        const findAddress = await Address.findOne({"address._id":addressId});
        if(!findAddress){
            return res.status(STATUS_CODES.NOT_FOUND).send("Address not found");
        }
        await Address.updateOne({
            "address._id":addressId
        },
    {
        $pull:{
            address:{
                _id:addressId
            }
        }
    }
)

res.redirect("/user/userProfile")
    } catch (error) {
        console.error("Error in delete address",error)
        res.redirect("/pageNotFound")
    }
}

const changePasswordOtpPage = async(req, res) => {
    try {
        if (!req.session.userOtp || !req.session.email) {
            return res.redirect('/user/change-password');
        }
        res.render('user/change-password-otp', { session: req.session });
    } catch (error) {
        console.error("Error in changePasswordOtpPage:", error);
        res.redirect('/user/change-password');
    }
}

const resendChangePasswordOtp = async(req, res) => {
    try {
        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email not found in session"
            });
        }

        console.log("Resending OTP to email:", email);
        const emailSent = await sendVerificationEmail(email, otp);
        
        if (emailSent) {
            console.log("Resend OTP:", otp);
            res.status(STATUS_CODES.OK).json({
                success: true,
                message: "OTP resent successfully"
            });
        } else {
            res.status(STATUS_CODES.BAD_REQUEST).json({
                success: false,
                message: "Failed to send OTP"
            });
        }
    } catch (error) {
        console.error("Error in resend change password otp:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
}

const resendEmailOtp = async(req, res) => {
    try {
        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        
        if (!email) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({
                success: false,
                message: "Email not found in session"
            });
        }

        console.log("Resending OTP to email:", email);
        const emailSent = await sendVerificationEmail(email, otp);
        
        if (emailSent) {
            console.log("Resend OTP:", otp);
            res.status(STATUS_CODES.OK).json({
                success: true,
                message: "OTP resent successfully"
            });
        } else {
            res.status(STATUS_CODES.BAD_REQUEST).json({
                success: false,
                message: "Failed to send OTP"
            });
        }
    } catch (error) {
        console.error("Error in resend email otp:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
}

const newEmailPage = async(req, res) => {
    try {
        if (!req.session.userOtp || !req.session.email) {
            return res.redirect('/user/change-email');
        }
        res.render('user/new-email', {
            session: req.session,
            userData: req.session.userData || {}
        });
    } catch (error) {
        console.error("Error in newEmailPage:", error);
        res.redirect('/user/change-email');
    }
}

const updateNewEmail = async(req, res) => {
    try {
        const { newEmail } = req.body;
        const userId = req.session.user;

        // Check if email already exists
        const emailExists = await User.findOne({ email: newEmail });
        if (emailExists) {
            return res.json({
                success: false,
                message: "This email is already registered"
            });
        }

        // Update user's email
        await User.findByIdAndUpdate(userId, { email: newEmail });

        res.json({
            success: true,
            message: "Email updated successfully",
            redirectUrl: "/user/userProfile"
        });
    } catch (error) {
        console.error("Error in updateNewEmail:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Failed to update email"
        });
    }
}

const loadShop = async (req, res) => {
    try {
        const user = req.session.user;
        const category = req.query.category; // Get the category from query parameters
        const brand = req.query.brand; // Get the brand from query parameters
        const sortOrder = req.query.sort || 'asc'; // Get the sort order
        const page = parseInt(req.query.page) || 1; // Get the current page
        const limit = 6; // Set the number of products per page
        const skip = (page - 1) * limit; // Calculate how many products to skip

        const query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };

        if (category) {
            query.category = category; // Filter by category if provided
        }

        if (brand) {
            query.brand = brand; // Filter by brand if provided
        }

        // Fetch filtered and sorted products
        const products = await Product.find(query)
            .sort({ salePrice: sortOrder === 'asc' ? 1 : -1 }) // Sort by price
            .skip(skip)
            .limit(limit)
            .lean();

        const totalProducts = await Product.countDocuments(query); // Get total count of filtered products
        const totalPages = Math.ceil(totalProducts / limit); // Calculate total pages

        res.render("user/shop", {
            user: user,
            products: products,
            currentPage: page,
            totalPages: totalPages,
            selectedCategory: category || null, // Pass the selected category
            selectedBrand: brand || null, // Pass the selected brand
            sortOrder: sortOrder, // Pass the sort order
            session: req.session
        });
    } catch (error) {
        console.error("Error loading shop:", error);
        res.redirect("/pageNotFound");
    }
};

const fetchOrders = async (req, res) => {
    try {
        const userId = req.session.user;
        const page = parseInt(req.query.page) || 1; // Current page
        const limit = 3; // Number of orders per page
        const skip = (page - 1) * limit; // Calculate how many orders to skip

        const orders = await Order.find({ userId: userId })
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage'
            })
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);

        const totalOrders = await Order.countDocuments({ userId: userId }); // Total orders count
        const totalPages = Math.ceil(totalOrders / limit); // Total pages

        res.json({
            orders: orders,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: "Error fetching orders" });
    }
}

module.exports={
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    changeEmail,
    changeEmailValid,
    changeEmailOtpPage,
    verifyEmailOtp,
    updateEmail,
    changePassword,
    changePasswordValid,
    verifyChangePassOtp,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    changePasswordOtpPage,
    resendChangePasswordOtp,
    resendEmailOtp,
    newEmailPage,
    updateNewEmail,
    loadShop,
    fetchOrders

}