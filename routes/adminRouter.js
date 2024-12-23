const express=require('express');
const router = express.Router();
const multer=require('multer')
const path=require('path')
const adminController = require("../controllers/admin/adminController");
const {userAuth,adminAuth}= require('../middlewares/auth')
const customerController=require("../controllers/admin/customerController")
const categoryController=require("../controllers/admin/categoryController")
const productController=require("../controllers/admin/productController")
const orderController=require("../controllers/admin/orderController")
const couponController=require("../controllers/admin/couponController");
const salesController=require("../controllers/admin/salesController");
// const { uploads } = ("../controllers/admin/productController");

// Configure storage for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'public', 'uploads', 'product-images'));
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

// Initialize multer
const uploads = multer({ storage: storage });


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


router.post("/addProducts",adminAuth,uploads.array("images",4),productController.addProducts);
router.get("/products",adminAuth,productController.getAllProducts)

// router.post("/addProducts",adminAuth,uploads,productController.addProducts);
// router.get("/products",adminAuth,productController.getAllProducts);

router.post("/addProductOffer",adminAuth,productController.addProductOffer);
router.post("/removeProductOffer",adminAuth,productController.removeProductOffer);
router.get("/blockProduct",adminAuth,productController.blockProduct)
router.get("/unblockProduct",adminAuth,productController.unblockProduct)

router.get("/editProduct", adminAuth, productController.getEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct);
router.post("/deleteImage",adminAuth,productController.deleteSingleImage)
router.post('/inventory/:productId/update', adminAuth, productController.updateProductQuantity);
// router.get('/products/edit/:productId', adminAuth, productController.editProduct);

/****ORDER Management */

router.get('/orderList',adminAuth,orderController. listOrders); // View all orders
router.post('/orders/:orderId/status',adminAuth,orderController. changeOrderStatus); // Change order status
router.delete('/orders/:orderId/cancel',adminAuth,orderController. cancelOrder); // Cancel an order

router.get('/inventory',adminAuth,orderController. manageInventory); // View and manage inventory

router.get('/orders/:orderId/details', adminAuth,orderController.getOrderDetails);
router.get('/orders/:orderId/detail', adminAuth, orderController.orderDetailPage);

//Coupon Management
router.get('/coupon',adminAuth,couponController.loadCoupon)
router.post('/createCoupon',adminAuth,couponController.createCoupon)
router.get('/editCoupon',adminAuth,couponController.editCoupon)
router.post('/updateCoupon',adminAuth,couponController.updateCoupon)
router.get('/deleteCoupon',adminAuth,couponController.deleteCoupon)

//Sales Report
router.get('/salesReport', adminAuth, salesController.renderSalesReport);
router.post('/getSalesReport', adminAuth, salesController.getSalesReport);
router.get('/downloadSalesReport/pdf', adminAuth, salesController.downloadPDF);
router.get('/downloadSalesReport/excel', adminAuth, salesController.downloadExcel);

// Dashboard route
router.get('/dashboard', adminController.loadDashboard);
router.get('/sales-data', adminController.getSalesData);
router.get('/top-selling-products', adminController.getTopSellingProducts);
router.get('/top-selling-categories', adminController.getTopSellingCategories);
router.get('/top-selling-brands', adminController.getTopSellingBrands);

module.exports=router;