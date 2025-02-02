const express=require('express');
const router=express.Router();
const userController= require('../controllers/user/userController')
const passport=require('../config/passport')
const profileController = require('../controllers/user/profileController');
const cartController = require('../controllers/user/cartController')
const orderController = require('../controllers/user/orderController')
const { userAuth } = require('../middlewares/auth');
const wishlistController=require('../controllers/user/wishlistController')

// router.get('/user/pageNotFound',userController.pageNotFound);

router.get('/user/signup',userController.loadSignup)
router.get('/',userController.loadHomepage)
router.get('/user/logout',userController.logout)
router.post('/user/signup',userController.signup)
router.post("/user/otp",userController.verifyOtp)
router.post("/user/resend-otp",userController.resendOtp)

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/user/login'}),(req,res)=>{
    
    req.session.user = req.user.id; 
    req.session.google = true;
    res.redirect('/')
});

router.get('/user/login',userController.loadLogin)
router.post('/user/login',userController.login)

router.get('/user/shop',userController.loadShop)
// router.get('/user/productDetails',userController.loadDetails)
router.get('/product/:productId',userController.getProductDetails);
router.get('/user/filter',userAuth,userController.filterProduct);
router.get("/user/filterPrice",userAuth,userController.filterByPrice);
router.post("/user/search",userAuth,userController.searchProduct)
router.get('/user/sort', userAuth, userController.sortProducts);

/*CART MANAGEMENT*/
// router.post('/user/cart/:productId', userAuth, cartController.addToCart);
// router.get("/user/cart",userAuth,cartController.viewCart)
// router.post('/user/cart/remove/:productId',userAuth,cartController.removeFromCart);
// router.get('/user/checkout',userAuth,cartController.checkout)
// router.post('/user/payment',userAuth,cartController.paymentPage); // Redirect to payment page
// router.post('/user/place-order',userAuth,cartController.placeOrder); // Handle order placement
// router.get('/user/order-success',userAuth,cartController.orderSuccess)
// router.post('/user/cancel-order/:orderId', userAuth, cartController.cancelOrder);
// router.get('/user/orders', userAuth, cartController.viewOrders);
// router.post('/user/cart/update/:productId', userAuth, cartController.updateQuantity);


router.post('/user/cart/add/:product_id', userAuth, cartController.addToCart); // Add product to cart
router.get('/user/cart', userAuth, cartController.viewCart); // View cart items
router.post('/user/cart/remove', userAuth, cartController.removeFromCart); // Remove product from cart
router.post('/user/cart/update', userAuth, cartController.updateQuantity); // Update product quantity in cart
router.get('/user/checkout',userAuth,cartController.checkoutPage)
router.post('/user/payment',userAuth,cartController.paymentPage)
router.post('/user/place-order',userAuth,cartController.placeOrder);
router.get('/user/order-success',userAuth,cartController.orderSuccess)

router.get('/user/order/:orderId', userAuth,orderController.viewOrderDetails);
router.get('/user/orders',userAuth,orderController.allOrdersPage)
router.post('/user/order/:orderId/cancel',userAuth,orderController. cancelOrder);
router.get('/user/order/:orderId/cancel',userAuth,orderController. cancelOrder);
router.post('/user/order/:orderId/return', userAuth, orderController.returnOrder);
router.get('/user/order/:orderId/download-invoice', userAuth, orderController.downloadInvoice);




/*  PROFILE MANAGEMENT */

router.get('/user/forgot-password',profileController.getForgotPassPage);
router.post("/user/forgot-email-valid",profileController.forgotEmailValid);
router.post("/user/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/user/reset-password",profileController.getResetPassPage)
router.post("/user/resend-forgot-otp",profileController.resendOtp);
router.post("/user/reset-password",profileController.postNewPassword)
router.get("/user/userProfile",userAuth,profileController.userProfile)
router.get("/user/change-email",userAuth,profileController.changeEmail)
router.post("/user/change-email",userAuth,profileController.changeEmailValid)
router.post("/user/verify-email-otp",userAuth,profileController.verifyEmailOtp)
router.post("/user/update-email",userAuth,profileController.updateEmail)
router.get("/user/change-password",userAuth,profileController.changePassword)
router.post("/user/change-password",userAuth,profileController.changePasswordValid)
router.post("/user/verify-changepassword-otp",userAuth,profileController.verifyChangePassOtp);
router.post("/user/resend-changepassword-otp", userAuth, profileController.resendChangePasswordOtp);
router.post("/user/resend-email-otp", userAuth, profileController.resendEmailOtp);
router.get("/user/new-email", userAuth, profileController.newEmailPage);
router.post("/user/new-email", userAuth, profileController.updateNewEmail);
router.get('/fetch-orders', userAuth,profileController.fetchOrders);

/*************ADDRESS MANAGEMENT************ */

router.get("/user/addAddress",userAuth,profileController.addAddress);
router.post("/user/addAddress",userAuth,profileController.postAddAddress);
router.get("/user/editAddress",userAuth,profileController.editAddress);
router.post("/user/editAddress",userAuth,profileController.postEditAddress);
router.get("/user/deleteAddress",userAuth,profileController.deleteAddress)

// Add this new route
router.get("/user/change-email-otp", userAuth, profileController.changeEmailOtpPage)
router.get("/user/change-password-otp", userAuth, profileController.changePasswordOtpPage);

// Wishlist Management Routes
router.get("/user/wishlist", userAuth, wishlistController.loadWishlist);
router.post("/user/addToWishlist", userAuth, wishlistController.addToWishlist);
router.get("/user/removeFromWishlist", userAuth, wishlistController.removeFromWishlist);

router.post('/user/apply-coupon', userAuth, cartController.applyCoupon);
router.post('/user/remove-coupon',userAuth, cartController.removeCoupon);

router.post('/user/create-razorpay-order', userAuth, cartController.createRazorpayOrder);
router.post('/user/verify-payment', userAuth, cartController.verifyPayment);
// router.post('/user/retry-payment/:orderId',userAuth,cartController. retryPayment);


module.exports= router;