const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const multer = require('multer');

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../public/uploads/product-images'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Create an `uploads` instance with multer, allowing up to 4 images
const uploads = multer({ storage: storage }).array("images", 4);

// Fetch the product add page
const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });
        res.render("admin/product-add", {
            cat: category,
            brand: brand
        });
    } catch (error) {
        res.redirect("/admin/pageerror");
    }
};

// Add a new product with validation
// const addProducts = async (req, res) => {
//     try {
//         const products = req.body;
//         const errors = {};

//         // Validation checks based on criteria provided
//         if (!products.productName || products.productName.trim() === "") errors.productName = "Please enter a product name.";
//         if (!products.description || products.description.trim() === "") errors.description = "Please enter a product description.";
//         if (!products.regularPrice || isNaN(products.regularPrice) || parseFloat(products.regularPrice) <= 0) errors.regularPrice = "Please enter a valid regular price.";
//         if (!products.salePrice || isNaN(products.salePrice) || parseFloat(products.salePrice) <= 0) errors.salePrice = "Please enter a valid sale price.";
//         if (!products.color || products.color.trim() === "") errors.color = "Please enter a color.";
//         if (!products.quantity || isNaN(products.quantity) || parseInt(products.quantity) <= 0) errors.quantity = "Please enter a valid quantity.";

//         // Check if at least one image is uploaded
//         if (!req.files || req.files.length === 0) errors.images = "Please upload at least one image.";

//         // Check for existing product name
//         const productExists = await Product.findOne({ productName: products.productName });
//         if (productExists) errors.productName = "Product name already exists. Please choose another name.";

//         // If validation fails, render the form again with errors
//         if (Object.keys(errors).length > 0) {
//             const category = await Category.find({ isListed: true });
//             const brand = await Brand.find({ isBlocked: false });
//             return res.render("admin/product-add", {
//                 cat: category,
//                 brand: brand,
//                 errors,
//                 formData: products
//             });
//         }

//         // Process images and save the product
//         const images = [];
//         if (req.files && req.files.length > 0) {
//             for (let i = 0; i < req.files.length; i++) {
//                 const originalImagePath = req.files[i].path;

//                 // Generate a unique name for the resized image
//                 const resizedImageName = `resized-${Date.now()}-${req.files[i].filename}`;
//                 const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedImageName);

//                 // Resize the image and save it
//                 await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);

//                 // Push the resized image name into the images array
//                 images.push(resizedImageName);

//                 // // Optional: Delete the original image to save space
//                 // fs.unlink(originalImagePath, (err) => {
//                 //     if (err) console.error("Error deleting original image:", err);
//                 // });
//             }
//         }

//         // Find the category ID based on the category name
//         const categoryId = await Category.findOne({ name: products.category });

//         // Create and save the new product
//         const newProduct = new Product({
//             productName: products.productName,
//             description: products.description,
//             brand: products.brand,
//             category: categoryId._id,
//             regularPrice: products.regularPrice,
//             salePrice: products.salePrice,
//             createdOn: new Date(),
//             quantity: products.quantity,
//             size: products.size,
//             color: products.color,
//             productImage: images,
//             status: "Available",
//         });

//         // Save the product to the database
//         await newProduct.save();

//         // Redirect to the product add page
//         return res.redirect('/admin/addProducts');
//     } catch (error) {
//         console.error("Error saving product", error);
//         return res.redirect("/admin/pageerror");
//     }
// };

const addProducts = async (req, res) => {
    try {
        const products = req.body;
        const errors = {};

        // Validation checks for required fields
        if (!products.productName || products.productName.trim() === "") errors.productName = "Please enter a product name.";
        if (!products.description || products.description.trim() === "") errors.description = "Please enter a product description.";
        if (!products.regularPrice || isNaN(products.regularPrice) || parseFloat(products.regularPrice) <= 0) errors.regularPrice = "Please enter a valid regular price.";
        if (!products.salePrice || isNaN(products.salePrice) || parseFloat(products.salePrice) <= 0) errors.salePrice = "Please enter a valid sale price.";
        if (!products.color || products.color.trim() === "") errors.color = "Please enter a color.";
        if (!products.quantity || isNaN(products.quantity) || parseInt(products.quantity) <= 0) errors.quantity = "Please enter a valid quantity.";

        // Check if at least one image is uploaded
        if (!req.files || req.files.length === 0) errors.images = "Please upload at least one image.";

        // Check for existing product name
        const productExists = await Product.findOne({ productName: products.productName });
        if (productExists) errors.productName = "Product name already exists. Please choose another name.";

        // If validation fails, render the form again with errors
        if (Object.keys(errors).length > 0) {
            const category = await Category.find({ isListed: true });
            const brand = await Brand.find({ isBlocked: false });
            return res.render("admin/product-add", {
                cat: category,
                brand: brand,
                errors,
                formData: products
            });
        }

        // Process images and save the product
        const images = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = req.files[i].path;

                // Resize and crop the uploaded image
                const resizedImageName = `resized-${Date.now()}-${req.files[i].filename}`;
                const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedImageName);

                // Resize the image and save it
                await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);

                // Push the resized image name into the images array
                images.push(resizedImageName);
            }
        }

        // Handle cropped images if they are included (assuming they are sent in the request body)
        if (req.body.croppedImages) {
            const croppedImages = JSON.parse(req.body.croppedImages); // Array of base64 encoded images
            for (let i = 0; i < croppedImages.length; i++) {
                const base64Data = croppedImages[i].replace(/^data:image\/\w+;base64,/, "");
                const buffer = Buffer.from(base64Data, 'base64');
                const croppedImageName = `cropped-${Date.now()}-${i + 1}.jpg`;
                const croppedImagePath = path.join('public', 'uploads', 'product-images', croppedImageName);

                // Write the cropped image to the disk
                fs.writeFileSync(croppedImagePath, buffer);
                images.push(croppedImageName);
            }
        }

        // Find the category ID based on the category name
        const categoryId = await Category.findOne({ name: products.category });

        // Create and save the new product
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: categoryId._id,
            regularPrice: products.regularPrice,
            salePrice: products.salePrice,
            createdOn: new Date(),
            quantity: products.quantity,
            size: products.size,
            color: products.color,
            productImage: images,
            status: "Available",
        });

        // Save the product to the database
        await newProduct.save();

        // Redirect to the product add page
        return res.redirect('/admin/addProducts');
    } catch (error) {
        console.error("Error saving product", error);
        return res.redirect("/admin/pageerror");
    }
};


const getAllProducts = async(req,res)=>{
    try {

        const search = req.query.search || "";
        const page=req.query.page || 1;
        const limit=4;

        const productData = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}}
            ],
        }).limit(limit*1).skip((page-1)*limit).populate('category').exec();

        const count = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}}
            ],
        }). countDocuments();

        const category = await Category.find({isListed:true});
        const brand = await Brand.find({isBlocked:false});

        if(category && brand){
            res.render("admin/products",{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,
                brand:brand,
            })
        }else{
            res.render("page-404")
        }
        
    } catch (error) {
        res.redirect("/admin/pageerror")
    }
};

const getEditProduct = async (req,res)=>{
    try {
        const id = req.query.id;
        const product = await Product.findOne({_id:id});
        const category = await Category.find({});
        const brand = await Brand.find({});
        res.render("edit-product",{
            product:product,
            cat:category,
            brand:brand,
        })
    } catch (error) {
        res.send("pageError");
    }
}

const editProduct = async(req,res)=>{
    try {
        const id = req.params.id;
        const product = await Product.findOne({_id:id});
        const data = req.body;
        const existingProduct = await Product.findOne({
            productName:data.productName,
            _id:{$ne:id}
        })
        if(existingProduct){
            return res.status(400).json({error:"Product already exists"});
        }
        const images =[];
        if(req.files && req.files.length>0){
            for(let i=0;i<req.files.length;i++){
                images.push(req.files[i].filename)
            }
        }

        const updateFields={
            productName:data.productName,
            description:data.description,
            brand:data.brand,
            category:product.category,
            regularPrice:data.regularPrice,
            salePrice:data.salePrice,
            quantity:data.quantity,
            color:data.color
        }
        if(req.files.length>0){
            updateFields.$push = {productImage:{$each:images}};
        }

        await Product.findByIdAndUpdate(id,updateFields,{new:true});
        res.redirect("/admin/products");
    } catch (error) {
        console.error(error);
        res.send("pageError")
    }
}


const deleteSingleImage=async (req,res)=>{
    try {
        const {imageNameToServer,productIdToServer}=req.body;
        const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImg:imageNameToServer}});
        const imagePath = path.join("public","uploads","product-images",imageNameToServer);
        if(fs.existsSync(imagePath)){
           await fs.unlinkSync(imagePath);
           console.log(`image ${imageNameToServer} deleted successfully`)
        }else{
            console.log(`image ${imageNameToServer} not found`);
            
        }
        res.send({status:true});
    } catch (error) {
        res.send("pageError")
    }
}

module.exports = {
    getProductAddPage,
    addProducts,
    uploads,
    getAllProducts,
    getEditProduct,
    editProduct,
    deleteSingleImage

    
};


