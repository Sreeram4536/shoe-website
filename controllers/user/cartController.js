const Cart = require('../../models/cartSchema');  // Assuming you are using this path
const Product = require('../../models/productSchema');  // Assuming you have a product model for price reference
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Coupon = require('../../models/couponSchema');
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema');
const Razorpay = require('razorpay');
const dotenv = require('dotenv');
const crypto = require('crypto');
const Wallet = require('../../models/walletSchema');
dotenv.config();

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Add item to cart
// const addToCart = async (req, res) => {
//     try {
//         const {product_id} = req.params; // Extract product ID from params
//         const userId = req.session.user; // Get user ID from session

//         console.log("Product ID in cart:", product_id);

//         // Check if the product exists
//         const product = await Product.findById(product_id); // Query the product by ID
//         if (!product || product.quantity <= 0) {
//             return res.status(400).send("Product is out of stock");
//         }

//         // Find or create the user's cart
//         let cart = await Cart.findOne({ userId });

//         if (!cart) {
//             // Initialize a new cart with all required fields
//             cart = new Cart({
//                 userId,
//                 items: [
//                     {
//                         productId: product_id,
//                         quantity: 1,
//                         price: product.salePrice,
//                         totalPrice: product.salePrice,
//                         status: "placed",
//                         cancelationReason: "none",
//                     },
//                 ],
//             });
//         } else {
//             // Ensure cart.items is always an array
//             cart.items = cart.items || [];

//             // Check if the product is already in the cart
//             const existingItem = cart.items.find(item => item.productId.toString() === product_id);

//             if (existingItem) {
//                 // Update the quantity and totalPrice if the product already exists in the cart
//                 existingItem.quantity += 1;
//                 existingItem.totalPrice = existingItem.quantity * existingItem.price;
//             } else {
//                 // Add new product to the cart
//                 cart.items.push({
//                     productId: product_id,
//                     quantity: 1,
//                     price: product.salePrice, // Set price from the product's salePrice
//                     totalPrice: product.salePrice, // Initial totalPrice = price * quantity
//                     status: "placed", // Default status for a new cart item
//                     cancelationReason: "none", // Default cancelationReason
//                 });
//             }
//         }

//         await cart.save(); // Save the cart to the database
//         res.redirect('/user/cart'); // Redirect to the cart view
//     } catch (error) {
//         console.error("Error in addToCart:", error);
//         res.status(500).send('Server error');
//     }
// };

const addToCart = async (req, res) => {
    try {
        const product_id = req.params.product_id;
        const userId = req.session.user;

        console.log("Adding to cart - Product ID:", product_id, "User ID:", userId); // Debug log

        // Check if the product exists
        const product = await Product.findById(product_id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Check if product has stock
        if (product.quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: "Product is out of stock"
            });
        }

        // Find user's cart
        let cart = await Cart.findOne({ userId });
        
        if (!cart) {
            // Create new cart if it doesn't exist
            cart = new Cart({
                userId,
                items: [{
                    productId: product_id,
                    quantity: 1,
                    price: product.salePrice,
                    totalPrice: product.salePrice,
                    status: "placed",
                    cancelationReason: "none",
                }]
            });
        } else {
            // Check if cart already has 3 different products
            if (cart.items.length >= 3 && !cart.items.find(item => item.productId.toString() === product_id)) {
                return res.status(400).json({
                    success: false,
                    message: "Cart cannot contain more than 3 different products"
                });
            }

            // Check if product already exists in cart
            const existingItem = cart.items.find(item => item.productId.toString() === product_id);

            if (existingItem) {
                // Check if new quantity would exceed stock
                if (existingItem.quantity + 1 > product.quantity) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot add more items. Only ${product.quantity} items available in stock`
                    });
                }
                
                existingItem.quantity += 1;
                existingItem.totalPrice = existingItem.quantity * existingItem.price;
            } else {
                // Add new item to cart
                cart.items.push({
                    productId: product_id,
                    quantity: 1,
                    price: product.salePrice,
                    totalPrice: product.salePrice,
                    status: "placed",
                    cancelationReason: "none",
                });
            }
        }

        await cart.save();
        
        return res.status(200).json({
            success: true,
            message: "Product added to cart successfully"
        });

    } catch (error) {
        console.error("Error in addToCart:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while adding to cart"
        });
    }
};
// Remove from Cart
const removeFromCart = async (req, res) => {
    try {
        const  product_id  = req.body.productId;
        const userId = req.session.user;
        console.log("rem cart",product_id);
        console.log(userId);
        
        
        

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).send("Cart not found");
        }

        // Remove the item from the cart
        // cart.items = cart.items.filter(item => item.productId.toString() !== product_id);
        // await cart.save();
        await Cart.updateOne(
            { userId },
            { $pull: { items: { productId: product_id } } }
        );

        res.status(200).json({ message: 'Item removed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};


// View Cart
const viewCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ userId: req.session.user }).populate('items.productId','productName salePrice productImage quantity');
        if (!cart) {
            return res.render('user/cart', { cart: null,session:req.session });
        }

        const totalCartPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        res.render('user/cart', { cart, totalCartPrice,session:req.session });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};


// const updateQuantity = async (req, res) => {
//     try {
//         const { product_id, quantity } = req.body;
//         const userId = req.session.user; // Get user ID from session
        
        

//         const cart = await Cart.findOne({ userId });
//         if (!cart) {
//             return res.status(404).json({ message: "Cart not found" });
//         }

//         // Find the item in the cart that needs to be updated
//         const item = cart.items.find(item => item.productId.toString() === product_id);
//         if (!item) {
//             return res.status(404).json({ message: "Item not found in cart" });
//         }

//         // Update the item's quantity and totalPrice
//         item.quantity = quantity;
//         item.totalPrice = quantity * item.price;

//         await cart.save();

//         res.status(200).json({ message: 'Quantity updated successfully' });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Something went wrong while updating the cart.' });
//     }
// };



// Update quantity function with improved stock checking
// const updateQuantity = async (req, res) => {
//     try {
//         const { product_id, quantity } = req.body;
//         const userId = req.session.user;

//         // Validate quantity is a positive number
//         const newQuantity = parseInt(quantity);
//         if (isNaN(newQuantity) || newQuantity < 1) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Please enter a valid quantity"
//             });
//         }

//         // Check product stock
//         const product = await Product.findById(product_id);
//         if (!product) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Product not found"
//             });
//         }

//         // Check if requested quantity exceeds available stock
//         if (newQuantity > product.quantity) {
//             return res.status(400).json({
//                 success: false,
//                 message: `Cannot update quantity. Only ${product.quantity} items available in stock`
//             });
//         }

//         const cart = await Cart.findOne({ userId });
//         if (!cart) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Cart not found"
//             });
//         }

//         const item = cart.items.find(item => item.productId.toString() === product_id);
//         if (!item) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Item not found in cart"
//             });
//         }

//         item.quantity = newQuantity;
//         item.totalPrice = newQuantity * item.price;

//         await cart.save();

//         res.status(200).json({
//             success: true,
//             message: 'Quantity updated successfully'
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({
//             success: false,
//             message: 'Server error while updating the cart'
//         });
//     }
// };

const updateQuantity = async (req, res) => {
    try {
        const { product_id, quantity } = req.body;
        const userId = req.session.user;

        // Validate quantity is a positive number
        const newQuantity = parseInt(quantity);
        if (isNaN(newQuantity) || newQuantity < 1) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid quantity"
            });
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });
        }

        const item = cart.items.find(item => item.productId._id.toString() === product_id);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart"
            });
        }

        // Update the item's quantity and totalPrice
        item.quantity = newQuantity;
        item.totalPrice = newQuantity * item.price; // Ensure totalPrice is updated based on new quantity

        await cart.save();

        res.status(200).json({
            success: true,
            message: 'Quantity updated successfully',
            cart
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating the cart'
        });
    }
};


const checkoutPage = async (req, res) => {
    try {
        const userId = req.session.user; // Get the authenticated user's ID from the session

        // Fetch the user's cart and populate product details
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            model: 'Product', // Populate the product details (like name, price, image)
        });

        // If no cart or cart items, redirect to the cart page
        if (!cart || cart.items.length === 0) {
            return res.redirect('/user/cart');
        }

        const allCoupons = await Coupon.find({ isList: true });

        // Fetch the user's address document
        const addressDocument = await Address.findOne({ userId });

        // Get the array of addresses from the document, or default to an empty array
        const addresses = addressDocument ? addressDocument.address : [];

        // Calculate the total price for all items in the cart
        let totalAmount = 0;
        cart.items.forEach(item => {
            totalAmount += item.totalPrice; // Each item's totalPrice should already be calculated
        });

        
        res.render('user/checkout', {
            cartItems: cart.items, // Send cart items to the frontend
            totalAmount: totalAmount, // Send the total amount to the frontend
            addresses: addresses, // Pass the array of addresses to the frontend
            allCoupons: allCoupons,
            session:req.session
        });
    } catch (err) {
        console.error('Error in checkout page:', err);
        res.redirect('/user/cart');
    }
};



// const placeOrder = async (req, res) => {
//     try {
//         const userId = req.session.user; // Ensure user is authenticated
//         const { chosenAddress } = req.body; // Extract address from the form
//         console.log("Chosen address ID from frontend:", chosenAddress);
//         // Fetch the user's cart
//         const userCart = await Cart.findOne({ userId }).populate('items.productId', 'productName salePrice quantity');
//         if (!userCart || userCart.items.length === 0) {
//             return res.status(400).send('Your cart is empty.');
//         }

//         // Validate the address
//         const userAddress = await Address.findOne({ userId, 'address._id': chosenAddress });
//         if (!userAddress) {
//             return res.status(404).send('Invalid address selected.');
//         }

//         const selectedAddress = userAddress.address.find(addr => addr._id.toString() === chosenAddress);
//         if (!selectedAddress) {
//             return res.status(404).send('Address not found.');
//         }

//         // Calculate total price
//         const totalPrice = userCart.items.reduce((total, item) => total + item.quantity * item.productId.salePrice, 0);
//         const discount = 0; // Add logic for discounts if applicable
//         const finalAmount = totalPrice - discount;

//         // Validate stock availability
//         for (const item of userCart.items) {
//             if (item.quantity > item.productId.quantity) {
//                 return res.status(400).send(`Insufficient stock for ${item.productId.productName}`);
//             }
//         }

//         // Create the order
//         const newOrder = new Order({
//             orderedItems: userCart.items.map(item => ({
//                 product: item.productId._id,
//                 quantity: item.quantity,
//                 price: item.productId.salePrice,
//             })),
//             userId,
//             totalPrice,
//             discount,
//             finalAmount,
//             address: chosenAddress,
//             invoiceDate: new Date(),
//             status: 'Pending', // Default order status
//             couponApplied: false, // Adjust if coupons are implemented
//         });

//         await newOrder.save();

//         // Update product quantities
//         for (const item of userCart.items) {
//             await Product.findByIdAndUpdate(item.productId._id, {
//                 $inc: { quantity: -item.quantity },
//             });
//         }

//         // Clear the user's cart
//         userCart.items = [];
//         await userCart.save();

//         // Redirect to a success page or render a confirmation
//         res.redirect(`/user/order-success?orderId=${newOrder._id}`);
//     } catch (error) {
//         console.error('Error placing order:', error);
//         res.status(500).send('Server Error');
//     }
// };

// const placeOrder = async (req, res) => {
//     try {
//         const userId = req.session.user;
//         const { chosenAddress, paymentMethod } = req.body;

//         // Fetch the user's cart
//         const cart = await Cart.findOne({ userId }).populate('items.productId');
//         if (!cart || cart.items.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Your cart is empty.'
//             });
//         }

//         // Calculate total amount
//         const totalAmount = cart.items.reduce((total, item) => 
//             total + (item.quantity * item.productId.salePrice), 0);

//         // Get coupon data from session if it exists
//         const couponDiscount = req.session.couponData ? req.session.couponData.discount : 0;
//         const finalAmount = req.session.couponData ? req.session.couponData.finalAmount : totalAmount;

//         // If payment method is wallet, check balance and update wallet
//         if (paymentMethod === 'Wallet') {
//             const wallet = await Wallet.findOne({ userId });
            
//             if (!wallet || wallet.balance < finalAmount) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Insufficient wallet balance'
//                 });
//             }

//             // Create wallet transaction
//             const walletTransaction = {
//                 transactionId: `TXN${Date.now()}`,
//                 amount: finalAmount,
//                 type: 'Debit',
//                 description: 'Order payment',
//                 status: 'Success'
//             };

//             // Update wallet balance and add transaction
//             await Wallet.findOneAndUpdate(
//                 { userId },
//                 {
//                     $inc: { balance: -finalAmount },
//                     $push: { transactions: walletTransaction }
//                 }
//             );
//         }

//         // Create the order
//         const orderData = {
//             orderedItems: cart.items.map(item => ({
//                 product: item.productId._id,
//                 quantity: item.quantity,
//                 price: item.price,
//             })),
//             userId,
//             totalPrice: totalAmount,
//             discount: couponDiscount,
//             finalAmount: finalAmount,
//             address: chosenAddress,
//             status: 'Pending',
//             invoiceDate: new Date(),
//             couponApplied: couponDiscount > 0,
//             paymentMethod: paymentMethod,
//             paymentStatus: paymentMethod === 'Wallet' ? 'Completed' : 'Pending'
//         };

//         const newOrder = new Order(orderData);
//         await newOrder.save();

//           // Update product sales count and category total sales
//        for (const item of orderData.orderedItems) {
//         await Product.findByIdAndUpdate(item.product, {
//             $inc: { 
//                 salesCount: item.quantity
//             },
//             lastSoldDate: new Date()
//         });
//          const product = await Product.findById(item.product);
//         await Category.findByIdAndUpdate(product.category, {
//             $inc: {
//                 totalSales: item.quantity * item.price,
//                 salesCount: item.quantity
//             }
//         });
//     }

//         // If wallet payment was successful, update the wallet transaction with orderId
//         if (paymentMethod === 'Wallet') {
//             await Wallet.findOneAndUpdate(
//                 { userId, 'transactions.transactionId': `TXN${Date.now()}` },
//                 { $set: { 'transactions.$.orderId': newOrder._id } }
//             );
//         }

//         // Update product quantities
//         for (const item of cart.items) {
//             await Product.findByIdAndUpdate(
//                 item.productId._id,
//                 { $inc: { quantity: -item.quantity } }
//             );
//         }

//         // Clear cart and coupon session data
//         cart.items = [];
//         await cart.save();
//         delete req.session.couponData;

//         // Send appropriate response
//         res.status(200).json({
//             success: true,
//             message: 'Order placed successfully',
//             orderId: newOrder._id
//         });

//     } catch (error) {
//         console.error('Error placing order:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Server Error while placing order'
//         });
//     }
// };

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { chosenAddress, paymentMethod, existingOrderId } = req.body;

        let order;

        // Check if an existing order ID was provided
        if (existingOrderId) {
            order = await Order.findById(existingOrderId);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Existing order not found.'
                });
            }

            // Update existing order details
            order.address = chosenAddress || order.address;
            order.paymentMethod = paymentMethod || order.paymentMethod;
            order.status = 'Pending';
            order.paymentStatus = paymentMethod === 'Wallet' ? 'Completed' : 'Pending';
            await order.save();
        } else {
            // Fetch the user's cart
            const cart = await Cart.findOne({ userId }).populate('items.productId');
            if (!cart || cart.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Your cart is empty.'
                });
            }

            // Calculate total amount
            const totalAmount = cart.items.reduce((total, item) => 
                total + (item.quantity * item.productId.salePrice), 0);

            // Get coupon data from session if it exists
            const couponDiscount = req.session.couponData ? req.session.couponData.discount : 0;
            const finalAmount = req.session.couponData ? req.session.couponData.finalAmount : (totalAmount + 0 +(totalAmount * 0.05)).toFixed(2);

            // If payment method is wallet, check balance and update wallet
            if (paymentMethod === 'Wallet') {
                const wallet = await Wallet.findOne({ userId });
                
                if (!wallet || wallet.balance < finalAmount) {
                    return res.status(400).json({
                        success: false,
                        message: 'Insufficient wallet balance'
                    });
                }

                // Create wallet transaction
                const walletTransaction = {
                    transactionId: `TXN${Date.now()}`,
                    amount: finalAmount,
                    type: 'Debit',
                    description: 'Order payment',
                    status: 'Success'
                };

                // Update wallet balance and add transaction
                await Wallet.findOneAndUpdate(
                    { userId },
                    {
                        $inc: { balance: -finalAmount },
                        $push: { transactions: walletTransaction }
                    }
                );
            }

            // Create a new order
            const orderData = {
                orderedItems: cart.items.map(item => ({
                    product: item.productId._id,
                    quantity: item.quantity,
                    price: item.price,
                })),
                userId,
                totalPrice: totalAmount,
                discount: couponDiscount,
                finalAmount: finalAmount,
                address: chosenAddress,
                status: 'Pending',
                invoiceDate: new Date(),
                couponApplied: couponDiscount > 0,
                paymentMethod: paymentMethod,
                paymentStatus: paymentMethod === 'Wallet' ? 'Completed' : 'Pending'
            };

            order = new Order(orderData);
            await order.save();

            // Update product sales count and category total sales
            for (const item of orderData.orderedItems) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { 
                        salesCount: item.quantity
                    },
                    lastSoldDate: new Date()
                });
                const product = await Product.findById(item.product);
                await Category.findByIdAndUpdate(product.category, {
                    $inc: {
                        totalSales: item.quantity * item.price,
                        salesCount: item.quantity
                    }
                });
            }

            // If wallet payment was successful, update the wallet transaction with orderId
            if (paymentMethod === 'Wallet') {
                await Wallet.findOneAndUpdate(
                    { userId, 'transactions.transactionId': `TXN${Date.now()}` },
                    { $set: { 'transactions.$.orderId': order._id } }
                );
            }

            // Update product quantities
            for (const item of cart.items) {
                await Product.findByIdAndUpdate(
                    item.productId._id,
                    { $inc: { quantity: -item.quantity } }
                );
            }

            // Clear cart and coupon session data
            cart.items = [];
            await cart.save();
            delete req.session.couponData;
        }

        // Send appropriate response
        res.status(200).json({
            success: true,
            message: existingOrderId ? 'Order updated for retry payment.' : 'Order placed successfully',
            orderId: order._id
        });

    } catch (error) {
        console.error('Error placing order:', error);
        return res.status(500).json({
            success: false,
            message: 'Server Error while placing order'
        });
    }
};


const paymentPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        if(!user){
            return res.redirect("/user/login");
        }

        // Fetch the user's cart
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.redirect('/user/cart');
        }

        // Calculate total amount
        const totalAmount = cart.items.reduce((total, item) => 
            total + (item.quantity * item.productId.salePrice), 0);

        const finalAmount = (totalAmount + 0 +(totalAmount * 0.05)).toFixed(2)
        

        // Fetch the address document
        const addressDocument = await Address.findOne({ userId });
        if (!addressDocument) {
            return res.status(404).send('Address document not found');
        }

        // Find the specific address from the address array
        const selectedAddress = addressDocument.address.find(
            addr => addr._id.toString() === req.body.chosenAddress
        );

        if (!selectedAddress) {
            return res.status(404).send('Selected address not found');
        }

        res.render('user/payment', {
            selectedAddress,
            totalAmount,
            finalAmount,
            user,
            session: req.session
        });

    } catch (err) {
        console.error('Error in payment page:', err);
        res.redirect('/user/checkout');
    }
};


const orderSuccess = async(req,res)=>{
    try {
        const orderId = req.query.orderId;
        console.log(orderId);
        
        // const orderData = await Order.findById(orderId);
    if (!orderId) {
        return res.status(400).send('Order ID is required.');
    }
    req.session.orderId = orderId;
    res.render('user/order-success', { orderId,session:req.session });
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const applyCoupon = async (req, res) => {
    try {
        const { couponCode, totalAmount } = req.body;
        const userId = req.session.user;

        console.log('Received request:', { couponCode, totalAmount }); // Debug log

        // Find the coupon
        const coupon = await Coupon.findOne({ 
            name: couponCode,
            isList: true
        });

        console.log('Found coupon:', coupon); // Debug log

        // if (req.session.couponData) {
        //     return res.json({
        //         success: false,
        //         message: 'A coupon is already applied. Please remove it before applying a new one.'
        //     });
        // }

        // If coupon doesn't exist
        if (!coupon) {
            return res.json({
                success: false,
                message: 'Invalid coupon code'
            });
        }

        // Check if coupon is expired
        const currentDate = new Date();
        if (currentDate > new Date(coupon.expiredOn)) {
            return res.json({
                success: false,
                message: 'This coupon has expired'
            });
        }

        // Check if coupon is not yet active
        if (currentDate < new Date(coupon.createdOn)) {
            return res.json({
                success: false,
                message: 'This coupon is not yet active'
            });
        }

        // Check minimum purchase requirement
        if (totalAmount < coupon.minimumPrice) {
            return res.json({
                success: false,
                message: `Minimum purchase of ₹${coupon.minimumPrice} required for this coupon`
            });
        }

        // Check if user has already used this coupon
        if (coupon.userId && coupon.userId.includes(userId)) {
            return res.json({
                success: false,
                message: 'You have already used this coupon'
            });
        }

        // Calculate final amount after discount
        const discount = coupon.offerPrice;
        const finalAmount = (totalAmount + 0 +(totalAmount * 0.05)).toFixed(2)- discount;

        // Store in session
        req.session.couponData = {
            code: couponCode,
            discount: discount,
            originalAmount: totalAmount,
            finalAmount: finalAmount
        };

        console.log('Coupon data stored in session:', req.session.couponData); // Debug log

        return res.json({
            success: true,
            discount: discount,
            finalAmount: finalAmount,
            message: 'Coupon applied successfully'
        });

    } catch (error) {
        console.error('Error in applyCoupon:', error);
        return res.status(500).json({
            success: false,
            message: 'Error applying coupon'
        });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user;
        const originalTotal = req.body.originalTotal;

        // Clear coupon session data
        delete req.session.couponData;

        return res.json({
            success: true,
            message: 'Coupon removed successfully',
            originalTotal: originalTotal
        });

    } catch (error) {
        console.error('Error removing coupon:', error);
        return res.status(500).json({
            success: false,
            message: 'Error removing coupon'
        });
    }
};

// const retryPayment = async (req, res) => {
//     try {
//         const { orderId } = req.params;

//         // Fetch the existing order
//         const order = await Order.findById(orderId);
//         if (!order) {
//             return res.status(404).json({ success: false, message: 'Order not found' });
//         }

//         if (order.paymentMethod !== 'RazorPay' || order.paymentStatus !== 'Pending') {
//             return res.status(400).json({ success: false, message: 'Retry payment is not applicable for this order' });
//         }

//         // Create a new Razorpay order
//         const razorpayOrder = await razorpay.orders.create({
//             amount: order.finalAmount * 100, // Amount in paise
//             currency: 'INR',
//             receipt: `retry_${order._id}`,
//             payment_capture: 1
//         });

//         res.status(200).json({ success: true, razorpayOrder });
//     } catch (error) {
//         console.error('Retry Payment Error:', error);
//         res.status(500).json({ success: false, message: 'Failed to retry payment' });
//     }
// };

// Create Razorpay order
// const createRazorpayOrder = async (req, res) => {
//     try {
//         const { amount } = req.body;
//         const userId = req.session.user;

//         if (!amount || amount <= 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid amount"
//             });
//         }

//         const options = {
//             amount: Math.round(amount * 100), // Convert to paise
//             currency: "INR",
//             receipt: `order_${Date.now()}_${userId}`,
//             payment_capture: 1
//         };

//         const order = await razorpay.orders.create(options);
        
//         res.status(200).json({
//             success: true,
//             order: order
//         });

//     } catch (error) {
//         console.error('Razorpay order creation failed:', error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to create payment order"
//         });
//     }
// };

// // Verify Razorpay payment
// const verifyPayment = async (req, res) => {
//     try {
//         const {
//             razorpay_payment_id,
//             razorpay_order_id,
//             razorpay_signature,
//             chosenAddress
//         } = req.body;

//         // Verify signature
//         const sign = razorpay_order_id + "|" + razorpay_payment_id;
//         const expectedSign = crypto
//             .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//             .update(sign.toString())
//             .digest("hex");

//         if (razorpay_signature !== expectedSign) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid payment signature"
//             });
//         }

//         const userId = req.session.user;
//         const cart = await Cart.findOne({ userId }).populate('items.productId');
        
//         if (!cart || cart.items.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Cart is empty"
//             });
//         }

//         // Calculate total amount
//         const totalAmount = cart.items.reduce((total, item) => 
//             total + (item.quantity * item.price), 0);

//         // Create order
//         const orderData = {
//             userId,
//             orderedItems: cart.items.map(item => ({
//                 product: item.productId._id,
//                 quantity: item.quantity,
//                 price: item.price
//             })),
//             totalPrice: totalAmount,
//             finalAmount: totalAmount,
//             address: chosenAddress,
//             status: 'Processing',
//             paymentMethod: 'RazorPay',
//             paymentStatus: 'Completed',
//             invoiceDate: new Date()
//         };

//         const newOrder = new Order(orderData);
//         await newOrder.save();

//         // Update product quantities
//         for (const item of cart.items) {
//             await Product.findByIdAndUpdate(
//                 item.productId._id,
//                 { $inc: { quantity: -item.quantity } }
//             );
//         }

//         // Clear cart
//         cart.items = [];
//         await cart.save();

//         res.status(200).json({
//             success: true,
//             message: "Payment verified successfully",
//             orderId: newOrder._id
//         });

//     } catch (error) {
//         console.error('Payment verification failed:', error);
//         res.status(500).json({
//             success: false,
//             message: "Payment verification failed"
//         });
//     }
// };

// const retryPayment = async (req, res) => {
//     try {
//         const { orderId } = req.params;
//         const order = await Order.findById(orderId);

//         if (!order) {
//             return res.status(404).json({ success: false, message: 'Order not found' });
//         }

//         if (order.paymentStatus === 'Completed') {
//             return res.status(400).json({ success: false, message: 'Payment already completed for this order' });
//         }

//         const razorpay = new Razorpay({
//             key_id: process.env.RAZORPAY_KEY_ID,
//             key_secret: process.env.RAZORPAY_KEY_SECRET
//         });

//         const razorpayOrder = await razorpay.orders.create({
//             amount: order.finalAmount * 100, // Amount in paise
//             currency: 'INR',
//             receipt: `order_${order._id}`,
//             payment_capture: 1
//         });

//         // Store the new Razorpay order ID in the existing order document
//         order.razorpayOrderId = razorpayOrder.id;
//         await order.save();

//         res.status(200).json({
//             success: true,
//             message: 'Razorpay order created successfully',
//             razorpayOrder
//         });
//     } catch (error) {
//         console.error('Error in retryPayment:', error);
//         res.status(500).json({ success: false, message: 'Failed to retry payment' });
//     }
// };

// const createRazorpayOrder = async (req, res) => {
//     try {
//         const { amount, existingOrderId } = req.body;
//         let order;

//         if (existingOrderId) {
//             order = await Order.findById(existingOrderId);

//             if (!order) {
//                 return res.status(404).json({ error: 'Order not found for retry payment' });
//             }

//             // Ensure the order is still in pending payment state
//             if (order.paymentStatus !== 'Pending') {
//                 return res.status(400).json({ error: 'Payment already completed for this order' });
//             }
//         } else {
//             return res.status(400).json({ error: 'Retry payment must provide existing orderId' });
//         }

//         const options = {
//             amount,
//             currency: 'INR',
//             receipt: `retry_${order._id}_${Date.now()}`
//         };

//         const razorpayOrder = await razorpay.orders.create(options);

//         res.json(razorpayOrder);
//     } catch (error) {
//         console.error('Error creating Razorpay order:', error);
//         res.status(500).json({ error: 'Error creating order for retry payment' });
//     }
// };


const createRazorpayOrder = async (req, res) => {
    try {
        const options = {
            amount: req.body.amount,
            currency: 'INR',
            receipt: 'order_' + Date.now(),
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Error creating order' });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            orderId
        } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign)
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ error: 'Order not found' });
            }

            order.paymentStatus = 'Completed';
            order.paymentId = razorpay_payment_id;
            order.paymentType = 'RazorPay';
            // order.status = 'Processing';

            await order.save();

            return res.status(200).json({
                success: true,
                message: 'Payment verified and order updated successfully.'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed.'
            });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during payment verification.'
        });
    }
};




// const verifyPayment = async (req, res) => {
//     try {
//         const {
//             razorpay_payment_id,
//             razorpay_order_id,
//             razorpay_signature,
//             chosenAddress,
//             paymentMethod
//         } = req.body;

//         const sign = razorpay_order_id + "|" + razorpay_payment_id;
//         const expectedSign = crypto
//             .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//             .update(sign)
//             .digest("hex");

//         if (razorpay_signature === expectedSign) {
//             // Create Order after successful payment verification
//             const userId = req.session.user;
//             const cart = await Cart.findOne({ userId }).populate('items.productId');
//             const totalAmount = cart.items.reduce((total, item) => total + (item.quantity * item.productId.salePrice), 0);
//             const couponDiscount = req.session.couponData ? req.session.couponData.discount : 0;
//             const finalAmount = req.session.couponData ? req.session.couponData.finalAmount : totalAmount;

//             const orderData = {
//                 orderedItems: cart.items.map(item => ({
//                     product: item.productId._id,
//                     quantity: item.quantity,
//                     price: item.price,
//                 })),
//                 userId,
//                 totalPrice: totalAmount,
//                 discount: couponDiscount,
//                 finalAmount: finalAmount,
//                 address: chosenAddress,
//                 status: 'Pending',
//                 invoiceDate: new Date(),
//                 couponApplied: couponDiscount > 0,
//                 paymentMethod,
//                 paymentStatus: 'Completed',
//                 paymentId: razorpay_payment_id,
//                 paymentType: 'RazorPay'
//             };

//             const newOrder = new Order(orderData);
//             await newOrder.save();

//             // Update Product Quantities
//             for (const item of cart.items) {
//                 await Product.findByIdAndUpdate(item.productId._id, { $inc: { quantity: -item.quantity } });
//             }

//             // Clear Cart
//             cart.items = [];
//             await cart.save();
//             delete req.session.couponData;

//             return res.status(200).json({
//                 success: true,
//                 message: 'Payment verified and order placed successfully.',
//                 orderId: newOrder._id
//             });
//         } else {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Payment verification failed.'
//             });
//         }
//     } catch (error) {
//         console.error('Error verifying payment:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Server error during payment verification.'
//         });
//     }
// };

// const verifyPayment = async (req, res) => {
//     try {
//         const {
//             razorpay_payment_id,
//             razorpay_order_id,
//             razorpay_signature,
//             chosenAddress,
//             paymentMethod,
//             orderId // Add orderId to detect retry payment scenario
//         } = req.body;

//         const sign = razorpay_order_id + "|" + razorpay_payment_id;
//         const expectedSign = crypto
//             .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//             .update(sign)
//             .digest("hex");

//         if (razorpay_signature === expectedSign) {
//             const userId = req.session.user;

//             if (orderId) {
//                 // Retry Payment Scenario
//                 const existingOrder = await Order.findOne({ _id: orderId, userId });

//                 if (!existingOrder) {
//                     return res.status(404).json({
//                         success: false,
//                         message: 'Order not found for retry payment.'
//                     });
//                 }

//                 if (existingOrder.paymentStatus === 'Completed') {
//                     return res.status(400).json({
//                         success: false,
//                         message: 'Payment already completed for this order.'
//                     });
//                 }

//                 // Update order payment details
//                 existingOrder.paymentStatus = 'Completed';
//                 existingOrder.paymentId = razorpay_payment_id;
//                 existingOrder.paymentType = 'RazorPay';
//                 existingOrder.status = 'Processing'; // Update status if needed

//                 await existingOrder.save();

//                 return res.status(200).json({
//                     success: true,
//                     message: 'Retry payment verified and order updated successfully.',
//                     orderId: existingOrder._id
//                 });
//             } else {
//                 // Initial Payment Scenario
//                 const cart = await Cart.findOne({ userId }).populate('items.productId');
//                 const totalAmount = cart.items.reduce((total, item) => total + (item.quantity * item.productId.salePrice), 0);
//                 const couponDiscount = req.session.couponData ? req.session.couponData.discount : 0;
//                 const finalAmount = req.session.couponData ? req.session.couponData.finalAmount : totalAmount;

//                 const orderData = {
//                     orderedItems: cart.items.map(item => ({
//                         product: item.productId._id,
//                         quantity: item.quantity,
//                         price: item.price,
//                     })),
//                     userId,
//                     totalPrice: totalAmount,
//                     discount: couponDiscount,
//                     finalAmount: finalAmount,
//                     address: chosenAddress,
//                     status: 'Pending',
//                     invoiceDate: new Date(),
//                     couponApplied: couponDiscount > 0,
//                     paymentMethod,
//                     paymentStatus: 'Completed',
//                     paymentId: razorpay_payment_id,
//                     paymentType: 'RazorPay'
//                 };

//                 const newOrder = new Order(orderData);
//                 await newOrder.save();

//                 // Update Product Quantities
//                 for (const item of cart.items) {
//                     await Product.findByIdAndUpdate(item.productId._id, { $inc: { quantity: -item.quantity } });
//                 }

//                 // Clear Cart
//                 cart.items = [];
//                 await cart.save();
//                 delete req.session.couponData;

//                 return res.status(200).json({
//                     success: true,
//                     message: 'Payment verified and order placed successfully.',
//                     orderId: newOrder._id
//                 });
//             }
//         } else {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Payment verification failed.'
//             });
//         }
//     } catch (error) {
//         console.error('Error verifying payment:', error);
//         return res.status(500).json({
//             success: false,
//             message: 'Server error during payment verification.'
//         });
//     }
// };


  


module.exports = {
    addToCart,
    viewCart,
    removeFromCart,
    updateQuantity,
    checkoutPage,
    placeOrder,
    paymentPage,
    orderSuccess,
    applyCoupon,
    removeCoupon,
    createRazorpayOrder,
    verifyPayment,
    
       
};