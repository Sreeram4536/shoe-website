const express=require('express');
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const {userAuth,adminAuth}= require('../middlewares/auth')
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController")
const productController=require("../controllers/admin/productController")
const { uploads } = require("../controllers/admin/productController");

router.get('/pageerror',adminController.pageerror)
router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/',adminAuth,adminController.loadDashboard)
router.get('/logout',adminController.logout)

//Customer management
router.get('/users',adminAuth,customerController.customerInfo)
router.get("/blockCustomer",adminAuth,customerController.customerBlocked)
router.get("/unblockCustomer",adminAuth,customerController.customerunBlocked)

//category management
router.get("/category",adminAuth,categoryController.categoryInfo)
router.post("/addCategory",adminAuth,categoryController.addCategory)
router.post("/addCategoryOffer",adminAuth,categoryController.addCategoryOffer)
router.post("/removeCategoryOffer",adminAuth,categoryController.removeCategoryOffer)
router.get("/listCategory",adminAuth,categoryController.getListCategory)
router.get("/unlistCategory",adminAuth,categoryController.getUnlistCategory)
router.get("/editCategory",adminAuth,categoryController.getEditCategory)
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);

//Product management
router.get("/addProducts",adminAuth,productController.getProductAddPage);
// router.post("/addProducts",adminAuth,uploads,productController.addProducts);
// router.get("/products",adminAuth,productController.getAllProducts)
router.post("/addProducts",adminAuth,uploads,productController.addProducts);
router.get("/products",adminAuth,productController.getAllProducts);

router.get("/editProduct",adminAuth,productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,productController.editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage)

module.exports=router;