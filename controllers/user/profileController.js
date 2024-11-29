const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const nodemailer=require("nodemailer");
const bcrypt = require('bcrypt');
const env = require("dotenv").config();
const seesion=require("express-session");
const { session } = require("passport");

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
        res.status(500).json({success:false,message:"An error occured.Please try again"})
        
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
            res.status(200).json({success:true,message:"Resend OTP successful"});
            
        }
        

    } catch (error) {
        console.error("Error in resend otp:",error);
        res.status(500).json({success:false,message:"Internal server error"})
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

// const userProfile = async(req,res)=>{
//     try {
//         const userId = req.session.user;
//         const userData = await User.findById(userId);
//         const addressData = await Address.findOne({userId:userId});

//         const orders = await Order.find({ userId: req.session.user })
//             .populate({
//                 path: 'orderedItems.product',
//                 select: 'productName productImage'
//             })
//             .populate({
//                 path: 'address',
//                 select: 'address'
//             })
//             .sort({ createdOn: -1 });

//         res.render('user/profile',{
//             user: userData,
//             userAddress: addressData,
//             orders: orders,
//             session: req.session
//         });
        
//     } catch (error) {
//         console.error("Error for retrieve profile:", error);
//         res.redirect("/pageNotFound")
//     }
// }

const userProfile = async(req,res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const addressData = await Address.findOne({userId:userId});

        // First get orders
        const orders = await Order.find({ userId: req.session.user })
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage'
            })
            .sort({ createdOn: -1 });

        // Then fetch all addresses for this user
        const userAddresses = await Address.findOne({ userId: req.session.user });

        // Prepare orders with address details
        const ordersWithAddress = orders.map(order => {
            const orderObj = order.toObject();
            if (userAddresses && userAddresses.address) {
                // Find the specific address from the address array using the stored address ID
                const deliveryAddress = userAddresses.address.find(
                    addr => addr._id.toString() === order.address.toString()
                );
                orderObj.deliveryAddress = deliveryAddress || null;
            }
            return orderObj;
        });

        res.render('user/profile', {
            user: userData,
            userAddress: addressData,
            orders: ordersWithAddress,
            session: req.session
        });
        
    } catch (error) {
        console.error("Error for retrieve profile:", error);
        res.redirect("/pageNotFound")
    }
}

const changeEmail = async(req,res)=>{
    try {

        res.render("user/change-email")
        
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
        res.status(500).json({
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

const postAddAddress =async (req,res)=>{
    try {

        const userId = req.session.user;
        const userData = await User.findOne({_id:userId});
        const{addressType,name,city,landMark,state,pincode,phone,altPhone}=req.body;
        const userAddress = await Address.findOne({userId:userData._id});
        if(!userAddress){
            const newAddress = new Address({
                userId : userData._id,
                address: [{addressType,name,city,landMark,state,pincode,phone,altPhone}]
            });
            await newAddress.save();
        }else{
            userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone});
            await userAddress.save();
        }
        res.redirect("/user/userProfile")
        
    } catch (error) {
        console.error("Error in addind address",error)
        res.redirect("/pageNotFound")
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

const postEditAddress = async(req,res)=>{
    try {
        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({"address._id":addressId});
        if(!findAddress){
            res.redirect("/pageNotFound")
        }
        await Address.updateOne(
            {"address._id":addressId},
            {$set:{
                "address.$":{
                    _id:addressId,
                    addressType:data.addressType,
                    name:data.name,
                    city:data.city,
                    landMark:data.landMark,
                    state:data.state,
                    pincode:data.pincode,
                    phone:data.phone,
                    altPhone:data.altPhone
                }
            }}
        )
        res.redirect("/user/userProfile")
    } catch (error) {
        console.error("Error in edit address",error);
        res.redirect("/pageNotFound")
        
    }
}

const deleteAddress = async(req,res)=>{
    try {
        const addressId = req.query.id;
        const findAddress = await Address.findOne({"address._id":addressId});
        if(!findAddress){
            return res.status(404).send("Address not found");
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
            res.status(200).json({
                success: true,
                message: "OTP resent successfully"
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to send OTP"
            });
        }
    } catch (error) {
        console.error("Error in resend change password otp:", error);
        res.status(500).json({
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
            return res.status(400).json({
                success: false,
                message: "Email not found in session"
            });
        }

        console.log("Resending OTP to email:", email);
        const emailSent = await sendVerificationEmail(email, otp);
        
        if (emailSent) {
            console.log("Resend OTP:", otp);
            res.status(200).json({
                success: true,
                message: "OTP resent successfully"
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to send OTP"
            });
        }
    } catch (error) {
        console.error("Error in resend email otp:", error);
        res.status(500).json({
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
        res.status(500).json({
            success: false,
            message: "Failed to update email"
        });
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
    updateNewEmail

}