const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const env=require('dotenv').config()
const nodemailer=require('nodemailer')
const bcrypt = require('bcrypt')
const mongoose=require('mongoose')

// const pageNotFound = async(req,res)=>{
//     try {
//        res.render('page-404') 
//     } catch (error) {
//         res.redirect('/user/pageNotFound')
//     }
// }

const loadSignup= async(req,res)=>{
    try {
       return res.render('user/signup') 
    } catch (error) {
        console.log("Page not loading:",error);
        res.status(500).send('Server Error')
        
    }
}

const loadHomepage = async(req,res)=>{
    try {
       
       const user = req.session.user;
       const categories = await Category.find({isListed:true});
       let productData = await Product.find({
        isBlocked:false,
        category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
       })
         productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
         productData=productData.slice(0,4);



       if(user){

        // const userData = await User.findOne({_id:user.id});
       const userData = await User.findById(user, 'name');
        res.render('user/home',{user:userData,products:productData,session: req.session});
       }else{
         return res.render('user/home',{products:productData,session:req.session});
       }
       
    } catch (error) {
        console.log('Home page not loading',error);
        res.status(500).send('Server Error')
    }
}

const logout = async(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
            console.log("Session destruction error",err.message);
            return res.redirect("/pageNotFound")
            }
            return res.redirect("/user/login")
            
        })
    } catch (error) {

        console.log("Logout error",error);
        res.redirect("/pageNotFound")
        
    }
}


function generateOtp(){
    return Math.floor(100000+Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp) {
    try {
        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info=await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your Account",
            text:`Your OTP is ${otp}`,
            html:`<b>Your OTP: ${otp}</b>`
        })

        return info.accepted.length >0

    } catch (error) {
        console.error("Error in sending email",error);
        return false;
        
    }
}

const signup= async(req,res)=>{
    
    try {
        const{name,phone,email,password}=req.body;
        const findUser= await User.findOne({email});
        if(findUser){
            return res.render("user/signup",{message:"User with this emailid already exists"})
        }
        
        const otp=generateOtp();
        const emailSent=await sendVerificationEmail(email,otp)

        if(!emailSent){
            return res.json("email.error")
        }
        req.session.userOtp=otp;
        req.session.userData={name,phone,email,password}

        res.render("user/otp");
        console.log("OTP SENT",otp)

    } catch (error) {
        console.error("Signup error",error);
        res.redirect("/pageNotFound")
    }
}

const securePassword= async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash;
    } catch (error) {
        
    }
}

// const verifyOtp = async (req,res)=>{
//     try {
//       const {otp} = req.body;
//       console.log(otp);
//       console.log("Received OTP:", req.body.otp);

//       if(otp===req.session.userOtp){
//         const user = req.session.userData
//         const passwordHash = await securePassword(user.password)

//         const saveUserData = new User({
//             name:user.name,
//             email:user.email,
//             phone:user.phone,
//             password:passwordHash,
//         })

//         await saveUserData.save();
//         req.session.user = saveUserData._id;
//         res.json({success:true,redirectUrl:"/"})
//       }else{
//         res.status(400).json({success:false,message:"Invalid OTP Please try again"})
//       }
        
//     } catch (error) {
//         console.error("Error verifying OTP",error);
//         res.status(500).json({success:false,message:"An error occured"})
        
//     }
// }

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log("Received OTP:", otp);
        console.log("Session OTP:", req.session.userOtp);
        console.log("User data in session:", req.session.userData);

        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
            });

            if (req.session.userData.googleId) {
                userData.googleId = req.session.userData.googleId;
            }

            await saveUserData.save();
            req.session.user = saveUserData._id;
            res.json({ success: true, redirectUrl: "/" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }
    } catch (error) {
        console.error("Error verifying OTP", error);
        res.status(500).json({ success: false, message: "An error occurred." });
    }
};

const resendOtp = async(req,res)=>{
    try {
       
        const {email}= req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp = generateOtp();
        req.session.userOtp=otp
        const emailSent = await sendVerificationEmail(email,otp)

        if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(200).json({success:true,message:"OTP Resend successfully"})
            
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP"})
        }
        
    } catch (error) {
        console.error("Error in resending OTP",error);
        res.status(500).json({success:false,message:"Internal server error.Please try again"})
        
    }
}

const loadLogin = async(req,res)=>{
    try {
        if(!req.session.user){
            return res.render("user/login")
        }else{
            res.redirect("/")
        }
    } catch (error) {
        
        res.redirect("/user/pageNotFound")

    }
}

const login = async(req,res)=>{
    try {

        const{email,password} = req.body;

        const findUser = await User.findOne({isAdmin:0,email:email});
        if(!findUser){
            return res.render('user/login',{message:"User not Found"})
        }
        if(findUser.isBlocked){
            return res.render("user/login",{message:"User is blocked by admin"})
        }


        
        const passwordMatch = await bcrypt.compare(password,findUser.password);
        if(!passwordMatch){
            return res.render('user/login',{maessage:"Incorrect password"})
        }
    

        req.session.user = findUser._id;
        // console.log("after logged:",req.session.user);
        
        
        res.redirect('/')
        console.log("logged in")

        
    } catch (error) {

        console.error("login error",error)
        res.render('user/login',{message:"Login failed..Please try again later."})
        
    }
}

const loadShop = async (req, res) => {
    try {
        const products = await Product.find(); // Fetch products from the database
        res.render('user/shop', { products }); // Pass products to shop.ejs
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

// const loadDetails = async (req, res) => {
//     try {
//         const products = await Product.find(); // Fetch products from the database
//         res.render('user/single', { products }); // Pass products to single.ejs
//     } catch (error) {
//         console.error(error);
//         res.status(500).send("Server Error");
//     }
// };


const getProductDetails = async (req, res) => {
    try {
       
        const { productId } = req.params;
        console.log(productId)
       
        
        
        // Fetch product details by ID and populate category details
        const product = await Product.findById(productId)
            .populate('category', 'name') // Get the category name (assuming category has a name field)
            .exec();

        if (!product) {
            return res.redirect('/pageNotFound');  // Redirect if product is not found
        }

        // Get related products by the same category
        const relatedProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: product._id }  // Exclude the current product from related products
        }).limit(4);  // Limit to 4 related products

        // Breadcrumbs for navigation
        // const breadcrumbs = [
        //     { name: 'Home', link: '/' },
        //     { name: product.category.name, link: `/category/${product.category.name}` },
        //     { name: product.productName, link: '' }
        // ];

        // Render product details page
        res.render('user/single', {
            product: product,
            relatedProducts: relatedProducts,
            // // breadcrumbs: breadcrumbs,
            title: product.productName,
            
        });
    } catch (error) {
        console.error("Error fetching product details:", error);
        res.redirect('/pageNotFound');
    }
};




module.exports={
    loadHomepage,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    loadShop,
    getProductDetails,
    logout
    // loadDetails
}