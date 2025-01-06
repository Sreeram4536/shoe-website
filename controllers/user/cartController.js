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
const STATUS_CODES = require('../../constants/statusCodes');
dotenv.config();

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});



const addToCart = async (req, res) => {
    try {
        const product_id = req.params.product_id;
        const userId = req.session.user;

        console.log("Adding to cart - Product ID:", product_id, "User ID:", userId); // Debug log

        // Check if the product exists
        const product = await Product.findById(product_id);
        if (!product) {
            return res.status(STATUS_CODES.NOT_FOUND).json({
                success: false,
                message: "Product not found"
            });
        }

        // Check if product has stock
        if (product.quantity <= 0) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({
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
                return res.status(STATUS_CODES.BAD_REQUEST).json({
                    success: false,
                    message: "Cart cannot contain more than 3 different products"
                });
            }

            // Check if product already exists in cart
            const existingItem = cart.items.find(item => item.productId.toString() === product_id);

            if (existingItem) {
                // Check if new quantity would exceed stock
                if (existingItem.quantity + 1 > product.quantity) {
                    return res.status(STATUS_CODES.BAD_REQUEST).json({
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
        
        return res.status(STATUS_CODES.OK).json({
            success: true,
            message: "Product added to cart successfully"
        });

    } catch (error) {
        console.error("Error in addToCart:", error);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
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
            return res.status(STATUS_CODES.NOT_FOUND).send("Cart not found");
        }

        // Remove the item from the cart
        // cart.items = cart.items.filter(item => item.productId.toString() !== product_id);
        // await cart.save();
        await Cart.updateOne(
            { userId },
            { $pull: { items: { productId: product_id } } }
        );

        res.status(STATUS_CODES.OK).json({ message: 'Item removed successfully' });
    } catch (error) {
        console.error(error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ message: 'Server error' });
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
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).send('Server error');
    }
};




const updateQuantity = async (req, res) => {
    try {
        const { product_id, quantity } = req.body;
        const userId = req.session.user;

        // Validate quantity is a positive number
        const newQuantity = parseInt(quantity);
        if (isNaN(newQuantity) || newQuantity < 1) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({
                success: false,
                message: "Please enter a valid quantity"
            });
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart) {
            return res.status(STATUS_CODES.NOT_FOUND).json({
                success: false,
                message: "Cart not found"
            });
        }

        const item = cart.items.find(item => item.productId._id.toString() === product_id);
        if (!item) {
            return res.status(STATUS_CODES.NOT_FOUND).json({
                success: false,
                message: "Item not found in cart"
            });
        }

        // Update the item's quantity and totalPrice
        item.quantity = newQuantity;
        item.totalPrice = newQuantity * item.price; // Ensure totalPrice is updated based on new quantity

        await cart.save();

        res.status(STATUS_CODES.OK).json({
            success: true,
            message: 'Quantity updated successfully',
            cart
        });
    } catch (error) {
        console.error(error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
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




const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { chosenAddress, paymentMethod, existingOrderId } = req.body;

        let order;

        // Check if an existing order ID was provided
        if (existingOrderId) {
            order = await Order.findById(existingOrderId);
            if (!order) {
                return res.status(STATUS_CODES.NOT_FOUND).json({
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
                return res.status(STATUS_CODES.BAD_REQUEST).json({
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
                    return res.status(STATUS_CODES.BAD_REQUEST).json({
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
        res.status(STATUS_CODES.OK).json({
            success: true,
            message: existingOrderId ? 'Order updated for retry payment.' : 'Order placed successfully',
            orderId: order._id
        });

    } catch (error) {
        console.error('Error placing order:', error);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
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
            return res.status(STATUS_CODES.NOT_FOUND).send('Address document not found');
        }

        // Find the specific address from the address array
        const selectedAddress = addressDocument.address.find(
            addr => addr._id.toString() === req.body.chosenAddress
        );

        if (!selectedAddress) {
            return res.status(STATUS_CODES.NOT_FOUND).send('Selected address not found');
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
        return res.status(STATUS_CODES.BAD_REQUEST).send('Order ID is required.');
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
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
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
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Error removing coupon'
        });
    }
};



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
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: 'Error creating order' });
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
                return res.status(STATUS_CODES.NOT_FOUND).json({ error: 'Order not found' });
            }

            order.paymentStatus = 'Completed';
            order.paymentId = razorpay_payment_id;
            order.paymentType = 'RazorPay';
            // order.status = 'Processing';

            await order.save();

            return res.status(STATUS_CODES.OK).json({
                success: true,
                message: 'Payment verified and order updated successfully.'
            });
        } else {
            return res.status(STATUS_CODES.BAD_REQUEST).json({
                success: false,
                message: 'Payment verification failed.'
            });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Server error during payment verification.'
        });
    }
};




  


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