const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');


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
const addProducts = async (req, res) => {
    try {
        const products = req.body;
        const productExists= await Product.findOne({
            productName:products.productName
        });

        if(!productExists){
            const images=[];
            if(req.files && req.files.length>0){
                for(let i=0;i<req.files.length;i++){
                    const originalImagePath=req.files[i].path;
                    const resizedImageName = `resized-${Date.now()}-${req.files[i].filename}`;
                    const resizedImagePath=path.join('public','uploads','product-images',resizedImageName);
                    await sharp(originalImagePath).resize({width:440,height:440}).toFile(resizedImagePath);
                    images.push(resizedImageName)
                }
            }
        
        // const errors = {};

        // // Validation checks for required fields
        // if (!products.productName || products.productName.trim() === "") errors.productName = "Please enter a product name.";
        // if (!products.description || products.description.trim() === "") errors.description = "Please enter a product description.";
        // if (!products.regularPrice || isNaN(products.regularPrice) || parseFloat(products.regularPrice) <= 0) errors.regularPrice = "Please enter a valid regular price.";
        // if (!products.salePrice || isNaN(products.salePrice) || parseFloat(products.salePrice) <= 0) errors.salePrice = "Please enter a valid sale price.";
        // if (!products.color || products.color.trim() === "") errors.color = "Please enter a color.";
        // if (!products.quantity || isNaN(products.quantity) || parseInt(products.quantity) <= 0) errors.quantity = "Please enter a valid quantity.";

        // // Check if at least one image is uploaded
        // if (!req.files || req.files.length === 0) errors.images = "Please upload at least one image.";

        // // Check for existing product name
        // const productExists = await Product.findOne({ productName: products.productName });
        // if (productExists) errors.productName = "Product name already exists. Please choose another name.";

        // // If validation fails, render the form again with errors
        // if (Object.keys(errors).length > 0) {
        //     const category = await Category.find({ isListed: true });
        //     const brand = await Brand.find({ isBlocked: false });
        //     return res.render("admin/product-add", {
        //         cat: category,
        //         brand: brand,
        //         errors,
        //         formData: products
        //     });
        // }

        // // Process images and save the product
        // const images = [];
        // if (req.files && req.files.length > 0) {
        //     for (let i = 0; i < req.files.length; i++) {
        //         const originalImagePath = req.files[i].path;

        //         // Resize and crop the uploaded image
        //         const resizedImageName = `resized-${Date.now()}-${req.files[i].filename}`;
        //         const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedImageName);

        //         // Resize the image and save it
        //         await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath);

        //         // Push the resized image name into the images array
        //         images.push(resizedImageName);
        //     }
        // }

        // console.log(req.files)

        // // Handle cropped images if they are included (assuming they are sent in the request body)
        // if (req.body.croppedImages) {
        //     const croppedImages = JSON.parse(req.body.croppedImages); // Array of base64 encoded images
        //     for (let i = 0; i < croppedImages.length; i++) {
        //         const base64Data = croppedImages[i].replace(/^data:image\/\w+;base64,/, "");
        //         const buffer = Buffer.from(base64Data, 'base64');
        //         const croppedImageName = `cropped-${Date.now()}-${i + 1}.jpg`;
        //         const croppedImagePath = path.join('public', 'uploads', 'product-images', croppedImageName);

        //         // Write the cropped image to the disk
        //         fs.writeFileSync(croppedImagePath, buffer);
                // images.push(croppedImageName);
        //     }
        // }

        // Find the category ID based on the category name
        const categoryId = await Category.findOne({ name: products.category });

        if(!categoryId){
            return res.status(400).join("Invalid Category Name")
        }

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
            productImage: images, // Ensure this is properly populated
            status: "Available",
        });

        // Save the product to the database
        await newProduct.save();

        // Redirect to the product add page
        return res.redirect('/admin/addProducts');
    }
    
    } catch (error) {
        console.error("Error saving product", error);
        return res.redirect("/admin/pageerror");
    }
};



const getAllProducts = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = req.query.page || 1;
        const limit = 4;

        const productData = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
            ],
        }).limit(limit * 1).skip((page - 1) * limit).populate('category').exec();

        const count = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }
            ],
        }).countDocuments();

        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });

        if (category && brand) {
            res.render("admin/products", {
                data: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                brand: brand,
            });
        } else {
            res.render("page-404");
        }

    } catch (error) {
        res.redirect("/admin/pageerror");
    }
};

const addProductOffer=async(req,res)=>{
    try {

        const{productId,percentage}=req.body;
        const findProduct=await Product.findOne({_id:productId});
        const findCategory=await Category.findOne({_id:findProduct.category});
        if(findCategory.categoryOffer>percentage){
            return res.json({status:false,message:"This products category already has a category offer"})
        }

        findProduct.salePrice=findProduct.salePrice-Math.floor(findProduct.regularPrice*(percentage/100));
        findProduct.productOffer= parseInt(percentage);
        await findProduct.save();
        findCategory.categoryOffer=0;
        await findCategory.save();
        res.json({status:true});
        
    } catch (error) {
        res.redirect("/admin/pageerror");
        res.status(500).json({status:false,message:"Internal Server Error"});
        
    }
}

const removeProductOffer = async(req,res)=>{
    try {
        const {productId}=req.body
        const findProduct = await Product.findOne({_id:productId});
        const  percentage=findProduct.productOffer;
        // findProduct.salePrice=findProduct.salePrice+Math.floor(findProduct.regularPrice*(percentage/100));
        findProduct.salePrice=findProduct.regularPrice;
        findProduct.productOffer=0;
        await findProduct.save();
        res.json({status:true})
        
    } catch (error) {
        res.redirect("/pageerror")
        
    }
}

const blockProduct = async(req,res)=>{
    try {
        let id=req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/products");
    } catch (error) {
        res.redirect("/pageerror")
        
    }
}

const unblockProduct=async(req,res)=>{
    try {
        let id=req.query.id;
        await Product.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/products");
    } catch (error) {
        res.redirect("/pageerror")
    }
}

const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findOne({ _id: id });
        const category = await Category.find({});
        const brand = await Brand.find({});
        res.render("admin/edit-product", {
            product: product,
            cat: category,
            brand: brand,
        });
    } catch (error) {
        res.send("pageError");
    }
};

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({ _id: id });
        const data = req.body;
        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne:id }
        });

        if (existingProduct) {
            return res.status(400).json({ error: "Product already exists" });
        }

        const images = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                images.push(req.files[i].filename);
            }
        }

        const updateFields = {
            productName: data.productName,
            description: data.description,
            brand: data.brand,
            category: product.category,
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            quantity: data.quantity,
            size: data.size,
            color: data.color
        };

        if (req.files.length > 0) {
            updateFields.$push = { productImage: { $each: images } };
        }

        await Product.findByIdAndUpdate(id, updateFields, { new: true });
        res.redirect("/admin/products");
    } catch (error) {
        console.error(error);
        res.send("pageError");
    }
};

const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer } = req.body;
        const product = await Product.findByIdAndUpdate(productIdToServer, { $pull: { productImage: imageNameToServer } });
        const imagePath = path.join("public", "uploads", "product-images", imageNameToServer);
        if (fs.existsSync(imagePath)) {
            await fs.unlinkSync(imagePath);
            console.log(`Image ${imageNameToServer} deleted successfully`);
        } else {
            console.log(`Image ${imageNameToServer} not found`);
        }
        res.send({ status: "success", message: "Image deleted" });
    } catch (error) {
        console.log(error);
        res.status(500).send({ status: "error", message: "Failed to delete image" });
    }
};

const updateProductQuantity = async (req, res) => {
    try {
        const { productId } = req.params;
        const { quantity } = req.body;
        
        console.log('Updating product:', productId, 'with quantity:', quantity); // Add logging

        if (quantity < 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity cannot be negative'
            });
        }

        // Use findByIdAndUpdate for atomic update
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                $set: {
                    quantity: quantity,
                    status: quantity > 0 ? 'Available' : 'Out of Stock'
                }
            },
            { new: true } // This option returns the updated document
        );

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        console.log('Product updated:', updatedProduct); // Add logging

        res.status(200).json({
            success: true,
            message: 'Quantity updated successfully',
            newStatus: updatedProduct.status
        });
    } catch (error) {
        console.error('Error updating product quantity:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
};



module.exports = {
    getProductAddPage,
    addProducts,
    
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    updateProductQuantity

    
};



  