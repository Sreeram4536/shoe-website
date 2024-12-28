const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Brand = require("../../models/brandSchema")
const env=require('dotenv').config()
const nodemailer=require('nodemailer')
const bcrypt = require('bcrypt')
const mongoose=require('mongoose')
const Order = require('../../models/orderSchema')

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
        //  productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        // Sort by the `createdAt` field and take the latest 4 products
         productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
         productData=productData.slice(0,4);



       if(user){

        // const userData = await User.findOne({_id:user.id});
       const userData = await User.findById(user, 'name');
        // res.render('user/home',{user:userData,products:productData,session: req.session});
        return res.render('user/home', {
            user: userData,
            products: productData,
            session:req.session,
            googleSession: req.session.google || false
        });
       }else{
        //  return res.render('user/home',{products:productData,session:req.session});
         return res.render('user/home', { products: productData, googleSession: false, session:req.session });
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
        const{name,phone,email,password,cPassword}=req.body;
        // if(password!==cPassword){
        //     return res.render("user/signup",{message:"Password doesnt match!!"})
        // }
        req.session.userData={name,phone,email,password}
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
        const { category, search, order, page, gt, lt } = req.query; // Get price range from query
        const currentPage = parseInt(page) || 1;
        const itemsPerPage = 3;
        const skip = (currentPage - 1) * itemsPerPage;

        // Base Query
        const query = {
            isBlocked: false // Only fetch products that are not blocked
        };

        // Apply Filters
        if (category) query.category = category;

        // Apply Search
        if (search) {
            query.productName = { $regex: search, $options: "i" }; // Case-insensitive search
        }

        // Apply Price Filtering
        if (gt && lt) {
            query.salePrice = { $gte: parseFloat(gt), $lte: parseFloat(lt) }; // Filter by price range
        }

        // Set default sort order to ascending if not specified
        let sortOrder = {};
        if (order === "asc") {
            sortOrder.salePrice = 1;
        } else if (order === "desc") {
            sortOrder.salePrice = -1;
        } else {
            sortOrder.salePrice = 1; // Default to ascending order
        }

        // Fetch Products
        const products = await Product.find(query)
            .sort(sortOrder)
            .skip(skip)
            .limit(itemsPerPage)
            .lean();

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / itemsPerPage);

        // Fetch Categories
        const categories = await Category.find({ isListed: true });

        // Render the Shop Page
        res.render("user/shop", {
            products,
            categories,
            totalPages,
            currentPage,
            totalProducts,
            selectedCategory: category || null,
            searchQuery: search || "",
            sortOrder: order || "asc", // Ensure the sort order is passed correctly
            priceRange: { gt, lt }, // Pass the price range to the view
            session: req.session
        });
    } catch (error) {
        console.error("Error loading shop:", error);
        res.status(500).send("Server Error");
    }
};



// const loadShop = async (req, res) => {
//     try {
//         const user = req.session.user;
//         const userData = await User.findOne({ _id: user });
//         const categories = await Category.find({ isListed: true });
//         const categoryIds = categories.map((category) => category._id.toString());
        
//         // Get query parameters
//         const page = parseInt(req.query.page) || 1;
//         const limit = 3;
//         const skip = (page - 1) * limit;

//         // Initialize filter and sort variables
//         const query = {
//             isBlocked: false,
//             category: { $in: categoryIds }
//         };

//         // Apply filters
//         if (req.query.category) {
//             query.category = req.query.category;
//         }
//         if (req.query.brand) {
//             query.brand = req.query.brand;
//         }

//         // Fetch products with sorting
//         let products = await Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
//         const totalProducts = await Product.countDocuments(query);
//         const totalPages = Math.ceil(totalProducts / limit);

//         res.render('user/shop', {
//             user: userData,
//             products: products,
//             category: categories,
//             totalProducts: totalProducts,
//             currentPage: page,
//             totalPages: totalPages,
//             selectedCategory: req.query.category || null,
//             selectedBrand: req.query.brand || null,
//             sortOrder: req.query.order || 'asc', // Maintain sort order
//             session: req.session
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).send("Server Error");
//     }
// };

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
        const breadcrumbs = [
            // { name: 'Home', link: '/' },
            { name: 'Home', link: '/', session: req.session.user || req.session.google },
            { name: product.category.name, link: `/category/${product.category.name}` },
            { name: product.productName, link: '' }
        ];

        // Render product details page
        res.render('user/single', {
            product: product,
            relatedProducts: relatedProducts,
            breadcrumbs: breadcrumbs,
            title: product.productName,
            session:req.session
            
        });
    } catch (error) {
        console.error("Error fetching product details:", error);
        res.redirect('/pageNotFound');
    }
};

// const filterProduct = async(req,res)=>{
//     try {
//         const user = req.session.user;
//         const category = req.query.category;
//         const brand = req.query.brand;
//         const findCategory = category ? await Category.findOne({_id:category}) : null;
//         const findBrand = brand ? await Brand.findOne({_id:brand}):null;
//         const brands = await Brand.find({}).lean();
//         const query = {
//             isBlocked:false,
//             quantity:{$gt:0}
//         }

//         if(findCategory){
//             query.category = findCategory._id;
//         }

//         if(findBrand){
//             query.brand = findBrand.brandName;
//         }

//         let findProducts = await Product.find(query).lean();
//         findProducts.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))

//         const categories =  await Category.find({isListed:true});
//         let itemsPerPage = 3;
//         let currentPage = parseInt(req.query.page)||1;
//         let startIndex = (currentPage-1) * itemsPerPage;
//         let endIndex = startIndex+itemsPerPage;
//         let totalPages = Math.ceil(findProducts.length/itemsPerPage);
//         const currentProduct = findProducts.slice(startIndex,endIndex);
//         let userData = null;
//         if(user){
//             userData = await User.findOne({_id:user});
//             if(userData){
//                 const searchEntry = {
//                     category: findCategory ? findCategory._id:null,
//                     brand: findBrand ? findBrand.brandName : null,
//                     searchedOn : new Date()
//                 }
//                 userData.searchHistory.push(searchEntry);
//                 await userData.save();
//             }
//         }

//         req.session.filteredProducts = currentProduct;
//         res.render("user/shop",{
//             user:userData,
//             products:currentProduct,
//             category: categories,
//             brand:brands,
//             totalPages,
//             currentPage,
//             selectedCategory:category || null,
//             selectedBrand: brand || null,
//             session:req.session,
//             sortOrder: req.query.order || 'asc',
//         })

//     } catch (error) {
//         res.redirect("/pageNotFound")
//     }
// }

// const filterByPrice = async (req,res)=>{
//     try {
//         const user = req.session.user;
//         const userData = await User.findOne({_id:user});
//         const brands = await Brand.find({}).lean();
//         const categories = await Category.find({isListed:true}).lean();
//         let gt = parseFloat(req.query.gt) || 0; // Default to 0 if not provided
//         let lt = parseFloat(req.query.lt) || Infinity; // Default to Infinity if not provided


//         let findProduct = await Product.find({
//             salePrice:{$gt:gt,$lt:lt},
//             isBlocked:false,
//             quantity:{$gt:0}
//         }).lean();

//         findProduct.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

//         let itemsPerPage = 3;
//         let currentPage = parseInt(req.query.page) || 1;
//         let startIndex = (currentPage-1)*itemsPerPage;
//         let endIndex = startIndex + itemsPerPage;
//         let totalPages = Math.ceil(findProduct.length/itemsPerPage);
//         const currentProduct = findProduct.slice(startIndex,endIndex);
//         req.session.filteredProducts = findProduct;

//         res.render("user/shop",{
//             user:userData,
//             products : currentProduct,
//             category:categories,
//             brand :brands,
//             totalPages,
//             currentPage,
//             selectedCategory:categories || null,
//             session:req.session,
//             sortOrder: req.query.order || 'asc',
//         })

//     } catch (error) {
//         console.log(error);
//         res.redirect("/pageNotFound")
        
//     }
// }

// const searchProduct = async(req,res)=>{
//     try {
//         const user = req.session.user;
//         const userData =  await User.findOne({_id:user});
//         let search = req.body.search?.trim() || '';
//         // console.log("search is:",search);
        

//         const brands = await Brand.find({}).lean();
//         const categories = await Category.find({isListed:true}).lean();
//         const categoryIds = categories.map(category=>category._id.toString());
//         let searchResult = [];
//         // console.log(req.session.filteredProducts);

//         if(req.session.filteredProducts && req.session.filteredProducts.length>0){
//             searchResult = req.session.filteredProducts.filter(product=>
//                 product.productName.toLowerCase().includes(search.toLowerCase())
//             )
//         }else{
//             searchResult = await Product.find({
//                 productName:{$regex:".*"+search+".*",$options:"i"},
//                 isBlocked:false,
//                 quantity:{$gt:0},
//                 category:{$in:categoryIds}
//             }).lean();
//         }
//         searchResult.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));

//         let itemsPerPage = 3;
//         let currentPage = parseInt(req.query.page) || 1;
//         let startIndex = (currentPage-1)*itemsPerPage;
//         let endIndex = startIndex + itemsPerPage;
//         let totalPages = Math.ceil(searchResult.length/itemsPerPage);
//         const currentProduct = searchResult.slice(startIndex,endIndex);
//         // req.session.filteredProducts = findProduct;
//         res.render("user/shop",{
//             user:userData,
//             products : currentProduct,
//             category:categories,
//             brand :brands,
//             totalPages,
//             currentPage,
//             count:searchResult.length,
//             searchResult,
//             sortOrder: req.query.order || 'asc',
//             selectedCategory:categories || null,
//             session:req.session
//         })

//     } catch (error) {
//         console.log("Error:",error);
//         res.redirect("/pageNotFound")
        
//     }
// }

// const sortProducts = async (req, res) => {
//     try {
//         const user = req.session.user;
//         const userData =  await User.findOne({_id: user});
//         const order = req.query.order || 'asc'; // Default to ascending
//         const categories = await Category.find({isListed: true});
//         const brands = await Brand.find({isBlocked: false});
        
//         // Base query
//         const query = {
//             isBlocked: false,
//             category: {$in: categories.map(category => category._id)}
//         };

       
//         // Sort products
//         let products = req.session.filteredProducts || await Product.find(query) ;
//         if (order === 'asc') {
//             // products = req.session.filteredProducts || await Product.find(query).sort({ salePrice: 1 });
//             products.sort((a, b) => a.salePrice - b.salePrice); 
//         } else {
//             // products = req.session.filteredProducts ||   await Product.find(query).sort({ salePrice: -1 });
//             products.sort((a, b) => b.salePrice - a.salePrice);
//         }

//         // Pagination
//         const page = parseInt(req.query.page) || 1;
//         const limit = 3;
//         const startIndex = (page - 1) * limit;
//         const endIndex = startIndex + limit;
//         const totalProducts = products.length;
//         const totalPages = Math.ceil(totalProducts / limit);
//         const currentProducts = products.slice(startIndex, endIndex);

//         res.render('user/shop', {
//             user: userData,
//             products: currentProducts,
//             category: categories,
//             brand: brands,
//             totalProducts: totalProducts,
//             currentPage: page,
//             totalPages: totalPages,
//             selectedCategory:categories,
//             session: req.session,
//             sortOrder: order // Pass the current sort order to maintain state
//         });

//     } catch (error) {
//         console.error("Error in sorting products:", error);
//         res.redirect("/pageNotFound");
//     }
// };

const filterProduct = async (req, res) => {
    
    res.redirect('/user/shop'); // Redirect to loadShop with proper query params
};

const filterByPrice = async (req, res) => {
    const { gt, lt } = req.query;

    // Redirect to loadShop with price filters included
    const queryString = `?gt=${gt || 0}&lt=${lt || Infinity}`;
    res.redirect(`/user/shop${queryString}`);
};

const searchProduct = async (req, res) => {
    const searchQuery = req.body.search?.trim();
    if (!searchQuery) return res.redirect('/shop'); // Redirect if search is empty

    // Redirect with search query
    res.redirect(`/user/shop?search=${encodeURIComponent(searchQuery)}`);
};

const sortProducts = async (req, res) => {
    const { order } = req.query;

    // Redirect with sorting preference
    const queryString = `?order=${order || "asc"}`;
    res.redirect(`/user/shop${queryString}`);
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
    logout,
    filterProduct,
    filterByPrice,
    searchProduct,
    sortProducts
    // loadDetails
}