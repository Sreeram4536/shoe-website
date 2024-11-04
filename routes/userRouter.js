const express=require('express');
const router=express.Router();
const userController= require('../controllers/user/userController')
const passport=require('../config/passport')

// router.get('/user/pageNotFound',userController.pageNotFound);

router.get('/user/signup',userController.loadSignup)
router.get('/',userController.loadHomepage)
router.post('/user/signup',userController.signup)
router.post("/user/otp",userController.verifyOtp)
router.post("/user/resend-otp",userController.resendOtp)

router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/user/signup'}),(req,res)=>{
    res.redirect('/')
});

router.get('/user/login',userController.loadLogin)
router.post('/user/login',userController.login)


module.exports= router;